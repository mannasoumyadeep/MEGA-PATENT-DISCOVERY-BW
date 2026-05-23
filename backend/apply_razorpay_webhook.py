"""
apply_razorpay_webhook.py — v3.8.4

Cumulative fixes:
  v3.8.1: AST-based function-boundary detection (replaced fragile regex)
  v3.8.3: column-0 import check (replaced strip() that matched indented imports)
  v3.8.4: AST-based import-statement detection (handles multi-line imports
          like `from services import (\\n  a,\\n  b,\\n)`)

The pattern: every time the patcher fails, the validator catches it BEFORE
writing, prints context, and we improve. This is the third refinement of
the import-insertion logic. AST-based detection should be the final answer:
it understands Python syntax natively, including multi-line constructs.

Usage:
  cd C:\\Users\\Som\\MEGA-PATENT-DISCOVERY-BW\\backend
  python apply_razorpay_webhook.py
"""
import ast
import sys
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
SERVER = ROOT / "server.py"

if not SERVER.exists():
    print("ERROR: Run from backend/ directory.")
    sys.exit(1)


# ============================================
# Replacement function bodies (same as v3.8.3)
# ============================================

NEW_GET_SETTINGS = '''
# ============================================
# DASHBOARD SETTINGS GET (v3.8.4 - computed from payments)
# ============================================
@app.get("/api/settings")
async def get_settings():
    """Returns dashboard settings with auto-computed Community Support total.
       Total = base_amount + sum(captured payments) - sum(processed refunds)."""
    try:
        doc = await db.settings.find_one({"_id": "dashboard"}) or {}
    except Exception:
        doc = {}

    base_amount = doc.get("base_amount")
    if base_amount is None:
        base_amount = doc.get("reimbursement_amount", 849)

    captured_total = 0.0
    refunded_total = 0.0
    payment_count = 0
    try:
        cursor = db.payments.aggregate([
            {"$match": {"event_type": "payment.captured"}},
            {"$group": {"_id": None,
                        "total": {"$sum": "$amount_rupees"},
                        "count": {"$sum": 1}}}
        ])
        async for row in cursor:
            captured_total = float(row.get("total", 0) or 0)
            payment_count = int(row.get("count", 0) or 0)

        cursor = db.payments.aggregate([
            {"$match": {"event_type": "refund.processed"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_rupees"}}}
        ])
        async for row in cursor:
            refunded_total = float(row.get("total", 0) or 0)
    except Exception:
        pass

    total_amount = float(base_amount) + captured_total - refunded_total

    return {
        "reimbursement_amount": round(total_amount, 2),
        "reimbursement_currency": doc.get("reimbursement_currency", "INR"),
        "reimbursement_label": doc.get("reimbursement_label", "Community Support"),
        "base_amount": float(base_amount),
        "captured_total": round(captured_total, 2),
        "refunded_total": round(refunded_total, 2),
        "payment_count": payment_count,
    }
'''.strip()


NEW_POST_SETTINGS = '''
@app.post("/api/settings")
async def update_settings(settings: dict):
    """Manually override base_amount (starting balance, before payments)."""
    from fastapi import HTTPException
    allowed = {"base_amount", "reimbursement_currency", "reimbursement_label"}
    update = {k: v for k, v in settings.items() if k in allowed}

    if "reimbursement_amount" in settings and "base_amount" not in update:
        update["base_amount"] = float(settings["reimbursement_amount"])

    if not update:
        raise HTTPException(400, "No valid settings provided")

    await db.settings.update_one(
        {"_id": "dashboard"},
        {"$set": update},
        upsert=True
    )
    return await get_settings()
'''.strip()


WEBHOOK_AND_AUDIT = '''
# ============================================
# RAZORPAY WEBHOOK (v3.8.4)
# Handles payment.captured, payment.failed, refund.processed.
# HMAC-verified, idempotent, strips PII.
# ============================================
@app.post("/api/razorpay/webhook")
async def razorpay_webhook(request: Request):
    """Handle Razorpay payment notifications."""
    from fastapi import HTTPException

    if not RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(500, "Webhook secret not configured on server")

    body_bytes = await request.body()
    received_signature = request.headers.get("X-Razorpay-Signature", "")

    expected = hmac.new(
        RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        body_bytes,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, received_signature):
        raise HTTPException(401, "Invalid signature")

    try:
        event = json.loads(body_bytes)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(400, "Invalid JSON payload")

    event_type = event.get("event", "")

    KNOWN_EVENTS = ("payment.captured", "payment.failed", "refund.processed")
    if event_type not in KNOWN_EVENTS:
        return {"status": "ok", "ignored": event_type}

    payload = event.get("payload", {}) or {}

    if event_type == "refund.processed":
        entity = (payload.get("refund", {}) or {}).get("entity", {}) or {}
        razorpay_event_id = entity.get("id", "")
        underlying_payment_id = entity.get("payment_id", "")
    else:
        entity = (payload.get("payment", {}) or {}).get("entity", {}) or {}
        razorpay_event_id = entity.get("id", "")
        underlying_payment_id = razorpay_event_id

    if not razorpay_event_id:
        raise HTTPException(400, "Missing entity ID in event")

    existing = await db.payments.find_one({
        "payment_id": razorpay_event_id,
        "event_type": event_type,
    })
    if existing:
        return {
            "status": "ok",
            "duplicate": True,
            "payment_id": razorpay_event_id,
        }

    amount_paise = int(entity.get("amount") or 0)
    amount_rupees = amount_paise / 100.0

    record = {
        "payment_id": razorpay_event_id,
        "underlying_payment_id": underlying_payment_id,
        "event_type": event_type,
        "amount_paise": amount_paise,
        "amount_rupees": amount_rupees,
        "currency": entity.get("currency", "INR"),
        "status": entity.get("status", "unknown"),
        "method": entity.get("method", "unknown"),
        "order_id": entity.get("order_id", ""),
        "received_at": datetime.utcnow().isoformat(),
    }
    await db.payments.insert_one(record)

    return {
        "status": "ok",
        "payment_id": razorpay_event_id,
        "event_type": event_type,
        "amount_rupees": amount_rupees,
    }


# ============================================
# PAYMENTS AUDIT ENDPOINT
# ============================================
@app.get("/api/admin/payments")
async def list_payments(limit: int = 50):
    """Returns recent payment records (audit trail)."""
    limit = max(1, min(limit, 500))
    cursor = db.payments.find({}).sort("received_at", -1).limit(limit)
    records = []
    async for r in cursor:
        r.pop("_id", None)
        records.append(r)
    return {"payments": records, "count": len(records)}
'''.strip()


# ============================================
# Helpers (AST-based)
# ============================================

def find_last_top_level_import_end_line(tree):
    """Return the end_lineno of the LAST top-level Import or ImportFrom.
       Returns 0 if no top-level imports found.
       
       Correctly handles multi-line imports because end_lineno spans the
       entire statement including the closing ')'.
    """
    last_end = 0
    for node in tree.body:  # only top-level nodes
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            end = node.end_lineno
            if end > last_end:
                last_end = end
    return last_end


def has_module_import(tree, module_name, optional_name=None):
    """Check if `import module_name` or `from module_name import ...` exists.
       If optional_name is given, also verifies that name is in the imports.
    """
    for node in tree.body:
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == module_name and optional_name is None:
                    return True
        elif isinstance(node, ast.ImportFrom):
            if node.module == module_name:
                if optional_name is None:
                    return True
                for alias in node.names:
                    if alias.name == optional_name:
                        return True
    return False


def has_simple_import(tree, name):
    """Check if `import <name>` exists at top level."""
    for node in tree.body:
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == name:
                    return True
    return False


def has_from_import_anywhere(tree, dotted_name):
    """Check if any top-level `import X` includes the dotted name,
       or any `from X import Y` matches."""
    parts = dotted_name.split(".")
    return has_simple_import(tree, parts[0])


# ============================================
# Read current server.py and parse
# ============================================

print("=== v3.8.4 AST-based Razorpay webhook patcher ===\n")

server_text = SERVER.read_text(encoding="utf-8")

# Idempotency check
if "/api/razorpay/webhook" in server_text and "RAZORPAY_WEBHOOK_SECRET" in server_text:
    try:
        ast.parse(server_text)
        if 'refund.processed' in server_text:
            print("[OK] v3.8.x webhook patch already applied with refund.processed.")
            print("     Nothing to do. Push to git if not already done.")
            sys.exit(0)
        else:
            print("[INFO] Older webhook patch detected. Refreshing with v3.8.4...")
    except SyntaxError as e:
        print(f"[WARN] Webhook patch present but file has syntax error: {e}")
        backup = SERVER.with_suffix(".py.v3.8_backup")
        if backup.exists():
            print(f"       Restoring from {backup.name}...")
            shutil.copy(backup, SERVER)
            server_text = SERVER.read_text(encoding="utf-8")
            print("       Restored. Continuing.")

try:
    tree = ast.parse(server_text)
    print(f"[OK] Current server.py parses cleanly ({len(server_text.splitlines())} lines)")
except SyntaxError as e:
    print(f"[FAIL] Current server.py has syntax error: {e}")
    print(f"       Line {e.lineno}: {e.text!r}")
    sys.exit(1)


# ============================================
# Find /api/settings + webhook + audit endpoints to remove
# ============================================

print("\n=== Locating endpoints in AST ===")

to_remove = []

TARGET_PATHS = {
    "/api/settings": ("get", "post"),
    "/api/razorpay/webhook": ("post",),
    "/api/admin/payments": ("get",),
}

for node in ast.walk(tree):
    if not isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)):
        continue
    for dec in node.decorator_list:
        if not isinstance(dec, ast.Call):
            continue
        if not isinstance(dec.func, ast.Attribute):
            continue
        method = dec.func.attr
        if not dec.args:
            continue
        first_arg = dec.args[0]
        path_value = None
        if isinstance(first_arg, ast.Constant) and isinstance(first_arg.value, str):
            path_value = first_arg.value
        elif hasattr(ast, "Str") and isinstance(first_arg, ast.Str):
            path_value = first_arg.s
        if path_value in TARGET_PATHS and method in TARGET_PATHS[path_value]:
            start_line = min(d.lineno for d in node.decorator_list)
            end_line = node.end_lineno
            label = f'@app.{method}("{path_value}") {node.name}()'
            to_remove.append((start_line, end_line, label))
            print(f"  [FOUND] {label} at lines {start_line}-{end_line}")

if not to_remove:
    print("  [INFO] No matching endpoints found - will append fresh.")


# ============================================
# Splice: remove (bottom-up)
# ============================================

print("\n=== Splicing source ===")

lines = server_text.split("\n")
to_remove.sort(key=lambda x: -x[0])

for start, end, label in to_remove:
    removed = lines[start-1:end]
    del lines[start-1:end]
    print(f"  [REMOVED] {label} ({len(removed)} lines)")

source_after_delete = "\n".join(lines)

# Re-parse to find import positions correctly (and validate splice didn't break things)
try:
    fresh_tree = ast.parse(source_after_delete)
except SyntaxError as e:
    print(f"\n[FAIL] Source after removing endpoints has syntax error: {e}")
    print(f"       Line {e.lineno}: {e.text!r}")
    print("       This shouldn't happen - removed complete AST nodes.")
    print("       server.py NOT modified.")
    sys.exit(1)


# ============================================
# Determine needed imports (AST-based check)
# ============================================

imports_needed = []

if not has_simple_import(fresh_tree, "hmac"):
    imports_needed.append("import hmac")
if not has_simple_import(fresh_tree, "hashlib"):
    imports_needed.append("import hashlib")
if not has_simple_import(fresh_tree, "json"):
    imports_needed.append("import json")
if not has_simple_import(fresh_tree, "os"):
    imports_needed.append("import os")

# datetime: either `import datetime` or `from datetime import datetime`
if not (has_simple_import(fresh_tree, "datetime")
        or has_module_import(fresh_tree, "datetime", "datetime")):
    imports_needed.append("from datetime import datetime")

# Request from fastapi (AST check, not substring)
if not has_module_import(fresh_tree, "fastapi", "Request"):
    imports_needed.append("from fastapi import Request")


# ============================================
# Insert imports AFTER the last top-level import (using AST end_lineno)
# This handles multi-line imports correctly
# ============================================

if imports_needed:
    print(f"  [WILL ADD] imports: {', '.join(imports_needed)}")

    last_import_end = find_last_top_level_import_end_line(fresh_tree)

    src_lines = source_after_delete.split("\n")
    if last_import_end > 0:
        # last_import_end is 1-indexed. Insert AFTER that line.
        # In 0-indexed list, insert at position last_import_end.
        insert_pos = last_import_end
        print(f"  [INFO] Inserting after line {last_import_end} (end of last top-level import)")
    else:
        # No imports at all - insert at top
        insert_pos = 0
        print("  [INFO] No existing top-level imports - inserting at top")

    for imp in imports_needed:
        src_lines.insert(insert_pos, imp)
        insert_pos += 1
    source_after_delete = "\n".join(src_lines)
else:
    print("  [INFO] All required imports already present")


# ============================================
# Add RAZORPAY_WEBHOOK_SECRET constant
# ============================================

if "RAZORPAY_WEBHOOK_SECRET" not in source_after_delete:
    constant_block = ('\n\n# Razorpay webhook configuration (v3.8.4)\n'
                      'RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")\n')
    if "db = None" in source_after_delete:
        source_after_delete = source_after_delete.replace(
            "db = None", "db = None" + constant_block, 1)
        print("  [ADDED] RAZORPAY_WEBHOOK_SECRET (after db = None)")
    else:
        # Fallback: re-parse and insert after last top-level import
        try:
            tree_after_imports = ast.parse(source_after_delete)
            last_import_end = find_last_top_level_import_end_line(tree_after_imports)
            if last_import_end > 0:
                src_lines = source_after_delete.split("\n")
                src_lines.insert(last_import_end, constant_block)
                source_after_delete = "\n".join(src_lines)
                print(f"  [ADDED] RAZORPAY_WEBHOOK_SECRET (after line {last_import_end})")
            else:
                source_after_delete = constant_block + source_after_delete
                print("  [ADDED] RAZORPAY_WEBHOOK_SECRET (at top)")
        except SyntaxError:
            print("  [WARN] Could not place RAZORPAY_WEBHOOK_SECRET cleanly")


# ============================================
# Append new endpoint definitions
# ============================================

new_source = source_after_delete.rstrip() + "\n\n\n"
new_source += NEW_GET_SETTINGS + "\n\n\n"
new_source += NEW_POST_SETTINGS + "\n\n\n"
new_source += WEBHOOK_AND_AUDIT + "\n"

print("  [APPENDED] new GET /api/settings")
print("  [APPENDED] new POST /api/settings")
print("  [APPENDED] new POST /api/razorpay/webhook")
print("  [APPENDED] new GET /api/admin/payments")


# ============================================
# Validate
# ============================================

print("\n=== Validating ===")

try:
    ast.parse(new_source)
    print("[PASS] Patched server.py syntax is valid")
except SyntaxError as e:
    print(f"[FAIL] Patched output has syntax error: {e}")
    print(f"       Line {e.lineno}: {e.text!r}")
    new_lines = new_source.split("\n")
    if e.lineno:
        start = max(0, e.lineno - 5)
        end = min(len(new_lines), e.lineno + 5)
        print()
        print(f"Context (lines {start+1}-{end}):")
        for i in range(start, end):
            marker = ">>> " if (i + 1) == e.lineno else "    "
            print(f"  {marker}{i+1:4d}: {new_lines[i]}")
    print("\nserver.py NOT modified. No backup created.")
    sys.exit(1)


# ============================================
# Backup + write
# ============================================

backup = SERVER.with_suffix(".py.v3.8_backup")
if not backup.exists():
    shutil.copy(SERVER, backup)
    print(f"[BACKUP] Saved original as {backup.name}")
else:
    print(f"[BACKUP] Existing backup at {backup.name} preserved")

SERVER.write_text(new_source, encoding="utf-8")
print(f"[WROTE] server.py updated ({len(new_source.splitlines())} lines)")

print("\n=== DONE ===\n")
print("Next steps:")
print("  1. git add backend/server.py backend/apply_razorpay_webhook.py")
print('  2. git commit -m "v3.8.4: Razorpay webhook (AST imports, multi-line safe)"')
print("  3. git push origin main")
print("  4. Wait ~3-5 min for Render to redeploy")
print('  5. Test via Razorpay Dashboard - Webhooks - "Send Test Webhook"')
