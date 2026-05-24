"""
bootstrap_base_amount.py — One-time migration for v3.8

Sets settings.dashboard.base_amount so the displayed total doesn't drop to 0
when the new webhook logic takes over.

Logic:
  - If settings.dashboard.base_amount already exists, leave it
  - Else, copy reimbursement_amount → base_amount
  - Else, set base_amount = 849 (default)

Run AFTER apply_razorpay_webhook.py has been applied, but BEFORE pushing to git.

Usage:
  cd C:\\Users\\Som\\MEGA-PATENT-DISCOVERY-BW\\backend
  python bootstrap_base_amount.py
"""
from pymongo import MongoClient

MONGO_URL = "mongodb+srv://mega_admin:9ZXXVWWjI3WBPuqt@cluster0.s0lvb2s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"


def main():
    print("Connecting to Atlas...")
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    client.admin.command("ping")
    db = client.patent_db
    print("Connected.\n")

    settings = db.settings.find_one({"_id": "dashboard"}) or {}

    print("Current settings:")
    for k, v in settings.items():
        if k != "_id":
            print(f"  {k}: {v}")
    print()

    base_amount = settings.get("base_amount")
    if base_amount is not None:
        print(f"[OK] base_amount already set: {base_amount}")
        print("Nothing to do. The Community Support widget will show:")
        print(f"     base_amount + sum(captured payments) − sum(refunded payments)")
        client.close()
        return

    # Need to bootstrap
    legacy_amount = settings.get("reimbursement_amount", 849)
    print(f"Bootstrapping base_amount from current reimbursement_amount: {legacy_amount}")

    db.settings.update_one(
        {"_id": "dashboard"},
        {"$set": {
            "base_amount": float(legacy_amount),
            "reimbursement_currency": settings.get("reimbursement_currency", "INR"),
            "reimbursement_label": settings.get("reimbursement_label", "Community Support"),
        }},
        upsert=True,
    )

    updated = db.settings.find_one({"_id": "dashboard"})
    print("\nAfter migration:")
    for k, v in updated.items():
        if k != "_id":
            print(f"  {k}: {v}")

    # Verify payments collection is accessible (create index for speed)
    print("\nEnsuring payments collection has indexes...")
    db.payments.create_index([("payment_id", 1), ("event_type", 1)], unique=True)
    db.payments.create_index([("received_at", -1)])
    db.payments.create_index([("event_type", 1)])
    print("[OK] Indexes ready (payment_id+event_type unique, received_at, event_type)")

    payment_count = db.payments.count_documents({})
    print(f"\nCurrent payments collection: {payment_count} records")

    client.close()
    print("\nDONE. Next: push to git with deploy_v3.8.bat")


if __name__ == "__main__":
    main()
