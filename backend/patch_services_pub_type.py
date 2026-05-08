"""
patch_services_pub_type.py — Fixes the PUB_TYPE_BY_PART reversal.

USER'S CORRECTION:
  Part 1 PDF → "Early Publication" (currently incorrectly: "Publication After 18 Months")
  Part 2 PDF → "Publication After 18 Months" (currently incorrectly: "Early Publication")
  Part 3 PDF → "Publication After 18 Months" (unchanged)

After running this, re-run weekly_publish.py to refresh Atlas with correct types.

Usage:
  cd C:\\Users\\Som\\MEGA-PATENT-DISCOVERY-BW\\backend
  python patch_services_pub_type.py
"""
import re
import sys
from pathlib import Path

PATH = Path("services.py")

if not PATH.exists():
    print("ERROR: services.py not found. Run from backend/ directory.")
    sys.exit(1)

content = PATH.read_text(encoding="utf-8")

# The current (buggy) block looks like:
#   PUB_TYPE_BY_PART = {
#       1: "Publication After 18 Months",
#       2: "Early Publication",
#       3: "Publication After 18 Months",
#   }

OLD_BLOCK_PATTERN = re.compile(
    r'PUB_TYPE_BY_PART\s*=\s*\{[^}]*1:\s*"Publication After 18 Months"[^}]*2:\s*"Early Publication"[^}]*\}',
    re.DOTALL,
)

NEW_BLOCK = '''PUB_TYPE_BY_PART = {
    1: "Early Publication",
    2: "Publication After 18 Months",
    3: "Publication After 18 Months",
}'''

# Idempotency check — if already fixed, no-op
if re.search(r'PUB_TYPE_BY_PART\s*=\s*\{[^}]*1:\s*"Early Publication"[^}]*2:\s*"Publication After 18 Months"', content, re.DOTALL):
    print("Already patched. PUB_TYPE_BY_PART has correct values.")
    sys.exit(0)

if not OLD_BLOCK_PATTERN.search(content):
    print("WARNING: Could not find expected PUB_TYPE_BY_PART block.")
    print("Manual edit needed. Look for 'PUB_TYPE_BY_PART' in services.py.")
    print("Set: 1='Early Publication', 2='Publication After 18 Months', 3='Publication After 18 Months'")
    sys.exit(1)

new_content = OLD_BLOCK_PATTERN.sub(NEW_BLOCK, content)

# Syntax check
import ast
try:
    ast.parse(new_content)
    print("Syntax check: VALID")
except SyntaxError as e:
    print(f"SYNTAX ERROR: {e}")
    sys.exit(1)

PATH.write_text(new_content, encoding="utf-8")
print(f"Patched: {PATH}")
print("\nNext step: re-run weekly_publish.py to refresh Atlas with correct pub_types:")
print("  python weekly_publish.py 17/2026 --no-download")
