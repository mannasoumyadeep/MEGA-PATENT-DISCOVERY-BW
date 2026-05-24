"""
apply_full_payment_system.py — v3.9.1

Same as v3.9 but the GET /api/settings response now includes target_amount
(default ₹10,000) for the progress bar. POST /api/settings accepts target_amount
so you can change the goal without redeploying.

Endpoints added/replaced:
  GET  /api/settings         (computed from payments, now with target_amount)
  POST /api/settings         (manages base_amount AND target_amount)
  POST /api/create-order     (Razorpay Standard Checkout)
  POST /api/razorpay/webhook (HMAC verified, idempotent)
  GET  /api/admin/payments   (audit trail)

Required env vars on Render:
  RAZORPAY_WEBHOOK_SECRET
  RAZORPAY_KEY_ID
  RAZORPAY_KEY_SECRET

Usage:
  cd C:\\Users\\Som\\MEGA-PATENT-DISCOVERY-BW\\backend
  python apply_full_payment_system.py
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


NEW_GET_SETTINGS = '''
# ============================================
# DASHBOARD SETTINGS GET (v3.9.1 - now includes target_amount)
# ============================================
@app.get("/api/settings")
async def get_settings():
    """Returns dashboard settings with auto-computed Community Support total
       AND the quarterly target amount for the progress bar."""
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
        "target_amount": float(doc.get("target_amount", 10000)),
    }
'''.strip()


NEW_POST_SETTINGS = '''
@app.post("/api/settings")
async def update_settings(settings: dict):
    """Manually override base_amount or target_amount."""
    from fastapi import HTTPException
    allowed = {"base_amount", "target_amount", "reimbursement_currency", "reimbursement_label"}
    update = {}
    for k, v in settings.items():
        if k in allowed:
            if k in ("base_amount", "target_amount"):
                try:
                    update[k] = float(v)
                except (TypeError, ValueError):
                    raise HTTPException(400, f"{k} must be a number")
            else:
                update[k] = v

    if "reimbursement_amount" in settings and "base_amount" not in update:
        try:
            update["base_amount"] = float(settings["reimbursement_amount"])
        except (TypeError, ValueError):
            raise HTTPException(400, "reimbursement_amount must be a number")

    if not update:
        raise HTTPException(400, "No valid settings provided")

    await db.settings.update_one(
        {"_id": "dashboard"},
        {"$set": update},
        upsert=True
    )
    return await get_settings()
'''.strip()


CREATE_ORDER_ENDPOINT = '''
# ============================================
# RAZORPAY STANDARD CHECKOUT - ORDER CREATION (v3.9.1)
# ============================================
@app.post("/api/create-order")
async def create_order(request: dict):
    """Create a Razorpay order for Standard Checkout.
       Frontend posts: { "amount": int (in paise), "currency": "INR" }
       Returns: { order_id, amount, currency, key_id }"""
    from fastapi import HTTPException
    import urllib.request
    import urllib.error
    import base64
    import time as _time

    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

    if not key_id or not key_secret:
        raise HTTPException(
            500,
            "Razorpay API credentials not configured. "
            "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on Render."
        )

    amount = int(request.get("amount", 0))
    currency = request.get("currency", "INR")

    if amount < 100 or amount > 50_000_000:
        raise HTTPException(400, "Amount must be between Rs 1 and Rs 5,00,000")
    if currency != "INR":
        raise HTTPException(400, "Only INR currency supported")

    auth = base64.b64encode(f"{key_id}:{key_secret}".encode()).decode()
    payload = json.dumps({
        "amount": amount,
        "currency": currency,
        "receipt": f"support_{int(_time.time())}",
        "payment_capture": 1,
    }).encode()

    req = urllib.request.Request(
        "https://api.razorpay.com/v1/orders",
        data=payload,
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            order = json.loads(response.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:500]
        raise HTTPException(e.code, f"Razorpay API error: {body}")
    except urllib.error.URLError as e:
        raise HTTPException(503, f"Razorpay API unreachable: {e}")
    except Exception as e:
        raise HTTPException(500, f"Order creation failed: {e}")

    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": key_id,
    }
'''.strip()


WEBHOOK_AND_AUDIT = '''
# ============================================
# RAZORPAY WEBHOOK (v3.9.1)
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
        return {"status": "ok", "duplicate": True, "payment_id": razorpay_event_id}

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
# AST helpers (same as v3.8.4)
# ============================================

def find_last_top_level_import_end_line(tree):
    last_end = 0
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            if node.end_lineno > last_end:
                last_end = node.end_lineno
    return last_end


def has_simple_import(tree, name):
    for node in tree.body:
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == name:
                    return True
    return False


def has_module_import(tree, module_name, optional_name=None):
    for node in tree.body:
        if isinstance(node, ast.ImportFrom):
            if node.module == module_name:
                if optional_name is None:
                    return True
                for alias in node.names:
                    if alias.name == optional_name:
                        return True
    return False


# ============================================
# Main
# ============================================

print("=== v3.9.1 Razorpay full payment system patcher ===\n")

server_text = SERVER.read_text(encoding="utf-8")

# Idempotency: v3.9.1 marker is target_amount in get_settings
v391_present = ('target_amount' in server_text
                and '/api/create-order' in server_text
                and '/api/razorpay/webhook' in server_text)
if v391_present:
    try:
        ast.parse(server_text)
        print("[OK] v3.9.1 payment system already applied and syntax valid.")
        print("     Push to git if not already done.")
        sys.exit(0)
    except SyntaxError:
        backup = SERVER.with_suffix(".py.v3.9_backup")
        if backup.exists():
            shutil.copy(backup, SERVER)
            server_text = SERVER.read_text(encoding="utf-8")
            print("[INFO] Restored from backup. Continuing.")

try:
    tree = ast.parse(server_text)
    print(f"[OK] Current server.py parses cleanly ({len(server_text.splitlines())} lines)")
except SyntaxError as e:
    print(f"[FAIL] Current server.py has syntax error: {e}")
    print(f"       Line {e.lineno}: {e.text!r}")
    sys.exit(1)


# Find endpoints to remove
print("\n=== Locating endpoints in AST ===")
TARGET_PATHS = {
    "/api/settings": ("get", "post"),
    "/api/razorpay/webhook": ("post",),
    "/api/admin/payments": ("get",),
    "/api/create-order": ("post",),
}

to_remove = []
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


# Splice
print("\n=== Splicing source ===")
lines = server_text.split("\n")
to_remove.sort(key=lambda x: -x[0])
for start, end, label in to_remove:
    removed = lines[start-1:end]
    del lines[start-1:end]
    print(f"  [REMOVED] {label} ({len(removed)} lines)")

source_after_delete = "\n".join(lines)

try:
    fresh_tree = ast.parse(source_after_delete)
except SyntaxError as e:
    print(f"\n[FAIL] Source after removal has syntax error: {e}")
    sys.exit(1)


# Add needed imports
imports_needed = []
if not has_simple_import(fresh_tree, "hmac"):
    imports_needed.append("import hmac")
if not has_simple_import(fresh_tree, "hashlib"):
    imports_needed.append("import hashlib")
if not has_simple_import(fresh_tree, "json"):
    imports_needed.append("import json")
if not has_simple_import(fresh_tree, "os"):
    imports_needed.append("import os")
if not (has_simple_import(fresh_tree, "datetime")
        or has_module_import(fresh_tree, "datetime", "datetime")):
    imports_needed.append("from datetime import datetime")
if not has_module_import(fresh_tree, "fastapi", "Request"):
    imports_needed.append("from fastapi import Request")

if imports_needed:
    print(f"  [WILL ADD] imports: {', '.join(imports_needed)}")
    last_import_end = find_last_top_level_import_end_line(fresh_tree)
    src_lines = source_after_delete.split("\n")
    insert_pos = last_import_end if last_import_end > 0 else 0
    print(f"  [INFO] Inserting after line {insert_pos}")
    for imp in imports_needed:
        src_lines.insert(insert_pos, imp)
        insert_pos += 1
    source_after_delete = "\n".join(src_lines)

if "RAZORPAY_WEBHOOK_SECRET" not in source_after_delete:
    constant_block = ('\n\n# Razorpay configuration (v3.9.1)\n'
                      'RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")\n')
    if "db = None" in source_after_delete:
        source_after_delete = source_after_delete.replace(
            "db = None", "db = None" + constant_block, 1)
        print("  [ADDED] RAZORPAY_WEBHOOK_SECRET")


# Append all new endpoints
new_source = source_after_delete.rstrip() + "\n\n\n"
new_source += NEW_GET_SETTINGS + "\n\n\n"
new_source += NEW_POST_SETTINGS + "\n\n\n"
new_source += CREATE_ORDER_ENDPOINT + "\n\n\n"
new_source += WEBHOOK_AND_AUDIT + "\n"

print("  [APPENDED] GET /api/settings (now with target_amount)")
print("  [APPENDED] POST /api/settings (manages base + target)")
print("  [APPENDED] POST /api/create-order")
print("  [APPENDED] POST /api/razorpay/webhook")
print("  [APPENDED] GET /api/admin/payments")


# Validate
print("\n=== Validating ===")
try:
    ast.parse(new_source)
    print("[PASS] Patched server.py syntax is valid")
except SyntaxError as e:
    print(f"[FAIL] Syntax error: {e}")
    print(f"       Line {e.lineno}: {e.text!r}")
    new_lines = new_source.split("\n")
    if e.lineno:
        start = max(0, e.lineno - 5)
        end = min(len(new_lines), e.lineno + 5)
        print(f"\nContext (lines {start+1}-{end}):")
        for i in range(start, end):
            marker = ">>> " if (i + 1) == e.lineno else "    "
            print(f"  {marker}{i+1:4d}: {new_lines[i]}")
    sys.exit(1)

# Write
backup = SERVER.with_suffix(".py.v3.9_backup")
if not backup.exists():
    shutil.copy(SERVER, backup)
    print(f"[BACKUP] Saved as {backup.name}")

SERVER.write_text(new_source, encoding="utf-8")
print(f"[WROTE] server.py updated ({len(new_source.splitlines())} lines)")

print("\n=== DONE ===\n")
print("Next steps:")
print("  1. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to Render env vars")
print("     (if not already done — see README_v3.9.1.md)")
print("  2. Copy new Sidebar.js, App.js, and CSS to frontend (see README)")
print("  3. git add backend/ frontend/")
print('  4. git commit -m "v3.9.1: payment system + progress bar"')
print("  5. git push origin main")
print("  6. Wait ~5 min, then test by clicking Support on megapatents.in")
