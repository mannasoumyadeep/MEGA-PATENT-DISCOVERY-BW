"""
apply_v3.4_patches.py — Single backend patcher

Applies and verifies:
  1. services.py PUB_TYPE_BY_PART correction (Part 1 → Early Pub, Part 2 → 18 Months)
  2. server.py /api/settings GET + POST endpoints (idempotent)

Usage (run from backend/ dir):
  cd C:\\Users\\Som\\MEGA-PATENT-DISCOVERY-BW\\backend
  python apply_v3.4_patches.py
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
    print("ERROR: Run from backend/ directory (services.py and server.py not found here).")
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
        # Backup
        backup = SERVICES.with_suffix(".py.v3.4_backup")
        if not backup.exists():
            shutil.copy(SERVICES, backup)
        SERVICES.write_text(new_text, encoding="utf-8")
        print(f"  [FIXED] Swapped Part 1 and Part 2 pub_types")
        print(f"  [BACKUP] Saved at {backup.name}")
    except SyntaxError as e:
        print(f"  [ERROR] Patch produced invalid syntax: {e}")
        sys.exit(1)
else:
    print("  [WARNING] Could not find expected PUB_TYPE_BY_PART block.")
    print("  Check services.py manually. Look for PUB_TYPE_BY_PART = {...}")
    print("  Should be: 1: 'Early Publication', 2: 'Publication After 18 Months', 3: 'Publication After 18 Months'")

# ============================================
# PATCH 2: server.py — /api/settings endpoint
# ============================================
print("\n=== PATCH 2: server.py /api/settings ===")
server_text = SERVER.read_text(encoding="utf-8")

settings_endpoint_present = "/api/settings" in server_text and "DEFAULT_SETTINGS" in server_text

if settings_endpoint_present:
    print("  [OK] /api/settings endpoint already present in server.py")
else:
    print("  [APPLYING] Injecting /api/settings endpoint and DEFAULT_SETTINGS")

    SETTINGS_CONSTANT = '''

# ============================================
# DASHBOARD SETTINGS (v3.4 patch)
# ============================================
DEFAULT_SETTINGS = {
    "reimbursement_amount": 849,
    "reimbursement_currency": "INR",
    "reimbursement_label": "Reimbursement Collected",
}
'''

    SETTINGS_ENDPOINTS = '''

# ============================================
# DASHBOARD SETTINGS ENDPOINTS (v3.4 patch)
# ============================================
@app.get("/api/settings")
async def get_settings():
    """Returns dashboard settings (reimbursement amount, label, etc.)"""
    try:
        doc = await db.settings.find_one({"_id": "dashboard"})
        if not doc:
            return DEFAULT_SETTINGS
        doc.pop("_id", None)
        return doc
    except Exception as e:
        return DEFAULT_SETTINGS


@app.post("/api/settings")
async def update_settings(settings: dict):
    """Updates dashboard settings. POST a JSON body like:
       {"reimbursement_amount": 1500}
    """
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

    # Find a good injection point: after first @app.get definition
    # Place SETTINGS_CONSTANT near top (after imports), endpoints near bottom
    new_text = server_text

    # Place constant after `db = None` or similar early line
    if "db = None" in new_text:
        new_text = new_text.replace("db = None", "db = None" + SETTINGS_CONSTANT, 1)
    else:
        # Fallback: place right before first @app
        first_app = new_text.find("@app.")
        if first_app > 0:
            new_text = new_text[:first_app] + SETTINGS_CONSTANT + "\n" + new_text[first_app:]

    # Place endpoints at end of file
    new_text = new_text.rstrip() + SETTINGS_ENDPOINTS + "\n"

    try:
        ast.parse(new_text)
        backup = SERVER.with_suffix(".py.v3.4_backup")
        if not backup.exists():
            shutil.copy(SERVER, backup)
        SERVER.write_text(new_text, encoding="utf-8")
        print(f"  [INJECTED] /api/settings endpoint")
        print(f"  [BACKUP] Saved at {backup.name}")
    except SyntaxError as e:
        print(f"  [ERROR] Patch produced invalid syntax: {e}")
        sys.exit(1)

# ============================================
# VERIFICATION
# ============================================
print("\n=== VERIFICATION ===")
final_services = SERVICES.read_text(encoding="utf-8")
final_server = SERVER.read_text(encoding="utf-8")

if correct_pattern.search(final_services):
    print("  [PASS] services.py PUB_TYPE_BY_PART has correct values")
else:
    print("  [FAIL] services.py PUB_TYPE_BY_PART check failed")

if "/api/settings" in final_server and "DEFAULT_SETTINGS" in final_server:
    print("  [PASS] server.py has /api/settings endpoint")
else:
    print("  [FAIL] server.py /api/settings missing")

# Final syntax verification
try:
    ast.parse(final_services)
    print("  [PASS] services.py syntax valid")
except SyntaxError as e:
    print(f"  [FAIL] services.py syntax: {e}")
    sys.exit(1)

try:
    ast.parse(final_server)
    print("  [PASS] server.py syntax valid")
except SyntaxError as e:
    print(f"  [FAIL] server.py syntax: {e}")
    sys.exit(1)

print("\n=== DONE ===")
print("\nNext steps:")
print("  1. Re-run weekly_publish.py to refresh Atlas data:")
print("     python weekly_publish.py 17/2026 --no-download")
print("  2. Commit and push backend changes:")
print("     git add backend/services.py backend/server.py")
print("     git commit -m \"v3.4 backend patches\"")
print("     git push origin main")
print("  3. Render will auto-deploy in ~3-5 minutes")
print("  4. Verify with: curl https://mega-patent-backend.onrender.com/api/settings")
