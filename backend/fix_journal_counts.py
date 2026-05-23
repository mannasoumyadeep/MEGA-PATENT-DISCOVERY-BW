"""
fix_journal_counts.py — Sync old/new field name pairs in journal records

The repair script already wrote mega_count=210 to Journal 19/2026. But the
deployed v3.3 server.py may return the OLD field name (mega_patents_count: 0)
in /api/journals responses. The frontend reads 0 and displays it.

This script writes the SAME value to both old AND new field names, so the
endpoint will return correct data regardless of which field name it returns.

Field pairs synced:
  mega_count          <->  mega_patents_count
  total_patents       <->  patents_count

Usage:
  cd C:\\Users\\Som\\MEGA-PATENT-DISCOVERY-BW\\backend
  python fix_journal_counts.py
"""
from pymongo import MongoClient

MONGO_URL = "mongodb+srv://mega_admin:9ZXXVWWjI3WBPuqt@cluster0.s0lvb2s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"


def main():
    print("Connecting to Atlas...")
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    client.admin.command("ping")
    db = client.patent_db
    print("Connected.\n")

    journals = list(db.journals.find({}))
    print(f"Found {len(journals)} journal records to sync\n")

    if not journals:
        print("No journals in database. Nothing to do.")
        client.close()
        return

    print("BEFORE sync:")
    for j in journals:
        print(f"  Journal {j.get('journal_no', '?')}:")
        print(f"    mega_count          = {j.get('mega_count', '<missing>')}")
        print(f"    mega_patents_count  = {j.get('mega_patents_count', '<missing>')}")
        print(f"    total_patents       = {j.get('total_patents', '<missing>')}")
        print(f"    patents_count       = {j.get('patents_count', '<missing>')}")

    print()
    print("Syncing fields (taking max value across name pairs)...")

    for j in journals:
        # Take the higher of the two for each pair (handles "one is 0, other is correct")
        mega_a = j.get("mega_count") or 0
        mega_b = j.get("mega_patents_count") or 0
        mega = max(mega_a, mega_b)

        total_a = j.get("total_patents") or 0
        total_b = j.get("patents_count") or 0
        total = max(total_a, total_b)

        db.journals.update_one(
            {"_id": j["_id"]},
            {"$set": {
                "mega_count": mega,
                "mega_patents_count": mega,
                "total_patents": total,
                "patents_count": total,
            }}
        )
        print(f"  Journal {j.get('journal_no', '?')}: mega={mega}, total={total}")

    print()

    # Verify
    print("AFTER sync:")
    for j in db.journals.find({}):
        print(f"  Journal {j.get('journal_no', '?')}:")
        print(f"    mega_count          = {j.get('mega_count')}")
        print(f"    mega_patents_count  = {j.get('mega_patents_count')}")
        print(f"    total_patents       = {j.get('total_patents')}")
        print(f"    patents_count       = {j.get('patents_count')}")

    client.close()
    print("\nDONE.")


if __name__ == "__main__":
    main()
