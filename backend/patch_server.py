"""
patch_server.py — Auto-patches server.py to add the /api/settings endpoints.

Usage (run once):
  cd C:\\Users\\Som\\MEGA-PATENT-DISCOVERY-BW\\backend
  python patch_server.py

What it does:
  1. Backs up server.py to server.py.pre_v3.2_backup
  2. Adds DEFAULT_SETTINGS constant
  3. Adds /api/settings GET and POST endpoints
  4. Seeds the settings collection on startup
  5. Verifies syntax before saving

Idempotent: safe to run multiple times. Detects if patches already applied.
"""
import re
import sys
from pathlib import Path
import shutil

SERVER_PATH = Path("server.py")
BACKUP_PATH = Path("server.py.pre_v3.2_backup")

# ============================================
# THE INJECTIONS
# ============================================
SETTINGS_CONSTANT = '''
# ============================================
# DASHBOARD SETTINGS (injected by patch_server.py v3.2)
# ============================================
DEFAULT_SETTINGS = {
    "reimbursement_amount": 849,
    "reimbursement_currency": "INR",
    "reimbursement_label": "Reimbursement Collected",
}

'''

SETTINGS_SEED_BLOCK = '''
    # Seed dashboard settings if collection is empty (v3.2 patch)
    try:
        if await db.settings.count_documents({}) == 0:
            await db.settings.insert_one({"_id": "dashboard", **DEFAULT_SETTINGS})
            log.info("Seeded default dashboard settings")
    except Exception as e:
        log.warning(f"Settings seed skipped: {e}")
'''

SETTINGS_ENDPOINTS = '''

# ============================================
# DASHBOARD SETTINGS ENDPOINTS (v3.2 patch)
# ============================================
@app.get("/api/settings")
async def get_settings():
    """Returns dashboard settings (reimbursement amount, label, etc.)"""
    doc = await db.settings.find_one({"_id": "dashboard"})
    if not doc:
        return DEFAULT_SETTINGS
    doc.pop("_id", None)
    return doc


@app.post("/api/settings")
async def update_settings(settings: dict):
    """Updates dashboard settings. POST a JSON body like:
       {"reimbursement_amount": 1500}
    Use curl, Postman, or MongoDB Compass to invoke this.
    """
    allowed = {"reimbursement_amount", "reimbursement_currency", "reimbursement_label"}
    update = {k: v for k, v in settings.items() if k in allowed}
    if not update:
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


def main():
    if not SERVER_PATH.exists():
        print(f"ERROR: {SERVER_PATH} not found. Run from backend/ directory.")
        sys.exit(1)

    content = SERVER_PATH.read_text(encoding="utf-8")

    # Idempotency check
    if "DEFAULT_SETTINGS" in content and "/api/settings" in content:
        print("Patches already applied. server.py looks up to date.")
        print("Use --force to re-apply.")
        if "--force" not in sys.argv:
            sys.exit(0)
        # Strip old patches
        content = re.sub(
            r"\n# ============================================\n# DASHBOARD SETTINGS.*?# ============================================\n",
            "\n",
            content,
            flags=re.DOTALL,
        )
        content = re.sub(
            r"\n    # Seed dashboard settings.*?log\.warning.*?\n",
            "\n",
            content,
            flags=re.DOTALL,
        )
        content = re.sub(
            r'\n@app\.get\("/api/settings"\).*?(?=\n@app\.|$)',
            "\n",
            content,
            flags=re.DOTALL,
        )

    # Backup
    if not BACKUP_PATH.exists():
        shutil.copy(SERVER_PATH, BACKUP_PATH)
        print(f"Backed up: {BACKUP_PATH}")

    # ============================================
    # PATCH 1: Inject DEFAULT_SETTINGS constant
    # Place after `JOBS: Dict[str, dict] = {}` block
    # ============================================
    patch1_marker = re.search(r"(JOBS_LOCK\s*=\s*threading\.Lock\(\)\s*\n)", content)
    if not patch1_marker:
        # Fallback: place after `db = None`
        patch1_marker = re.search(r"(db\s*=\s*None\s*\n)", content)

    if patch1_marker:
        insertion_point = patch1_marker.end()
        content = content[:insertion_point] + SETTINGS_CONSTANT + content[insertion_point:]
        print("Injected DEFAULT_SETTINGS constant")
    else:
        print("WARNING: Could not find injection point for DEFAULT_SETTINGS")

    # ============================================
    # PATCH 2: Inject seed block in startup_event
    # Find existing startup function and append before its end
    # ============================================
    # The startup function ends with `await db.patents.create_index("application_no", unique=True)`
    seed_marker = re.search(
        r'(await db\.patents\.create_index\("application_no",\s*unique=True\)\s*\n)',
        content,
    )
    if seed_marker:
        insertion_point = seed_marker.end()
        content = content[:insertion_point] + SETTINGS_SEED_BLOCK + content[insertion_point:]
        print("Injected settings seed block in startup")
    else:
        print("WARNING: Could not find startup_event injection point")

    # ============================================
    # PATCH 3: Inject the /api/settings endpoints
    # Place after /api/health endpoint
    # ============================================
    health_end = re.search(
        r'(@app\.get\("/api/health"\).*?return\s*\{[^}]+\}\s*\n)',
        content,
        flags=re.DOTALL,
    )
    if health_end:
        insertion_point = health_end.end()
        content = content[:insertion_point] + SETTINGS_ENDPOINTS + content[insertion_point:]
        print("Injected /api/settings endpoints")
    else:
        print("WARNING: Could not find /api/health endpoint to inject after")

    # ============================================
    # SYNTAX CHECK before writing
    # ============================================
    import ast
    try:
        ast.parse(content)
        print("Syntax check: VALID")
    except SyntaxError as e:
        print(f"SYNTAX ERROR after patching: {e}")
        print("Restoring from backup...")
        shutil.copy(BACKUP_PATH, SERVER_PATH)
        sys.exit(1)

    # Write
    SERVER_PATH.write_text(content, encoding="utf-8")
    print(f"\nDONE. Patched: {SERVER_PATH}")
    print(f"Backup at: {BACKUP_PATH}")
    print("\nTo update reimbursement amount, run:")
    print('  python -c "from pymongo import MongoClient; c = MongoClient(\'YOUR_MONGO_URL\'); c.patent_db.settings.update_one({\'_id\':\'dashboard\'}, {\'$set\':{\'reimbursement_amount\': 1500}}, upsert=True); print(\'Updated\'); c.close()"')


if __name__ == "__main__":
    main()
