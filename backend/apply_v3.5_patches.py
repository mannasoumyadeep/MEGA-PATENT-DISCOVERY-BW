"""
apply_v3.5_patches.py — Combined backend patcher

Applies and verifies all backend fixes accumulated since v3.3:
  1. services.py PUB_TYPE_BY_PART correction (Part 1 → Early, Part 2 → 18mo)
  2. server.py /api/settings GET + POST endpoints
  3. (Idempotent — safe to run multiple times)

Usage:
  cd C:\\Users\\Som\\MEGA-PATENT-DISCOVERY-BW\\backend
  python apply_v3.5_patches.py
"""
import re
import sys
import ast
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
SERVICES = ROOT / "services.py"
SERVER = ROOT / "server.py"

if not SERVICES.exists() or not SERVER.exists():
    print("ERROR: Run from backend/ directory.")
    sys.exit(1)


# ============================================
# PATCH 1: services.py — PUB_TYPE_BY_PART
# ============================================
print("\n=== PATCH 1: services.py PUB_TYPE_BY_PART ===")
services_text = SERVICES.read_text(encoding="utf-8")

correct_pattern = re.compile(
    r'PUB_TYPE_BY_PART\s*=\s*\{[^}]*1:\s*"Early Publication"[^}]*2:\s*"Publication After 18 Months"',
    re.DOTALL
)
buggy_pattern = re.compile(
    r'(PUB_TYPE_BY_PART\s*=\s*\{[^}]*?)1:\s*"Publication After 18 Months",?\s*\n(\s*)2:\s*"Early Publication"',
    re.DOTALL
)

if correct_pattern.search(services_text):
    print("  [OK] PUB_TYPE_BY_PART already correct")
elif buggy_pattern.search(services_text):
    new_text = buggy_pattern.sub(
        r'\g<1>1: "Early Publication",\n\g<2>2: "Publication After 18 Months"',
        services_text
    )
    try:
        ast.parse(new_text)
        backup = SERVICES.with_suffix(".py.v3.5_backup")
        if not backup.exists():
            shutil.copy(SERVICES, backup)
        SERVICES.write_text(new_text, encoding="utf-8")
        print(f"  [FIXED] Swapped Part 1 and Part 2 pub_types")
    except SyntaxError as e:
        print(f"  [ERROR] Patch produced invalid syntax: {e}")
        sys.exit(1)
else:
    print("  [WARNING] Could not find expected PUB_TYPE_BY_PART block")
    print("  Search services.py for PUB_TYPE_BY_PART manually")

# ============================================
# PATCH 2: server.py — /api/settings endpoint
# ============================================
print("\n=== PATCH 2: server.py /api/settings ===")
server_text = SERVER.read_text(encoding="utf-8")

if "/api/settings" in server_text and "DEFAULT_SETTINGS" in server_text:
    print("  [OK] /api/settings already present")
else:
    print("  [APPLYING] Injecting /api/settings endpoint")

    SETTINGS_CONSTANT = '''

# ============================================
# DASHBOARD SETTINGS (v3.5 patch)
# ============================================
DEFAULT_SETTINGS = {
    "reimbursement_amount": 849,
    "reimbursement_currency": "INR",
    "reimbursement_label": "Community Support",
}
'''

    SETTINGS_ENDPOINTS = '''

# ============================================
# DASHBOARD SETTINGS ENDPOINTS (v3.5 patch)
# ============================================
@app.get("/api/settings")
async def get_settings():
    """Returns dashboard settings (community support amount, label, etc.)"""
    try:
        doc = await db.settings.find_one({"_id": "dashboard"})
        if not doc:
            return DEFAULT_SETTINGS
        doc.pop("_id", None)
        return doc
    except Exception:
        return DEFAULT_SETTINGS


@app.post("/api/settings")
async def update_settings(settings: dict):
    """Updates dashboard settings (manual amount override)."""
    allowed = {"reimbursement_amount", "reimbursement_currency", "reimbursement_label"}
    update = {k: v for k, v in settings.items() if k in allowed}
    if not update:
        from fastapi import HTTPException
        raise HTTPException(400, "No valid settings provided")
    await db.settings.update_one(
        {"_id": "dashboard"},
        {"$set": update},
        upsert=True
    )
    doc = await db.settings.find_one({"_id": "dashboard"})
    doc.pop("_id", None)
    return doc
'''

    new_text = server_text

    # Inject constant after db = None
    if "db = None" in new_text:
        new_text = new_text.replace("db = None", "db = None" + SETTINGS_CONSTANT, 1)
    else:
        first_app = new_text.find("@app.")
        if first_app > 0:
            new_text = new_text[:first_app] + SETTINGS_CONSTANT + "\n" + new_text[first_app:]

    # Append endpoints at end
    new_text = new_text.rstrip() + SETTINGS_ENDPOINTS + "\n"

    try:
        ast.parse(new_text)
        backup = SERVER.with_suffix(".py.v3.5_backup")
        if not backup.exists():
            shutil.copy(SERVER, backup)
        SERVER.write_text(new_text, encoding="utf-8")
        print(f"  [INJECTED] /api/settings endpoint")
    except SyntaxError as e:
        print(f"  [ERROR] Patch produced invalid syntax: {e}")
        sys.exit(1)

# ============================================
# VERIFY
# ============================================
print("\n=== VERIFICATION ===")
final_services = SERVICES.read_text(encoding="utf-8")
final_server = SERVER.read_text(encoding="utf-8")

if correct_pattern.search(final_services):
    print("  [PASS] services.py PUB_TYPE_BY_PART correct")
else:
    print("  [WARN] PUB_TYPE_BY_PART check inconclusive")

if "/api/settings" in final_server:
    print("  [PASS] /api/settings endpoint present in server.py")
else:
    print("  [FAIL] /api/settings missing")

try:
    ast.parse(final_services)
    print("  [PASS] services.py syntax valid")
except SyntaxError as e:
    print(f"  [FAIL] services.py: {e}")
    sys.exit(1)

try:
    ast.parse(final_server)
    print("  [PASS] server.py syntax valid")
except SyntaxError as e:
    print(f"  [FAIL] server.py: {e}")
    sys.exit(1)

print("\n=== DONE ===")
print("\nNext steps:")
print("  1. Run repair script to fix mega_score data:")
print("     python repair_mega_scores.py")
print("  2. Commit and PUSH to git (critical — Render and Vercel only deploy on push):")
print("     git add backend/ frontend/")
print('     git commit -m "v3.5: community support framing, recent weeks list, repair"')
print("     git push origin main")
print("  3. Wait ~3-5 min, verify:")
print("     curl https://mega-patent-backend.onrender.com/api/settings")
