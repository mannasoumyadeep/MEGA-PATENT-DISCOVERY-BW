"""
repair_mega_scores.py — Recompute mega_score for all patents in Atlas

Why this exists:
  Diagnostic showed Journal 19/2026 has total_patents=2185, mega_count=210
  in the journal record, but only 0 patents in DB have mega_score >= 65.
  Something corrupted or never wrote the mega_score field properly.

  This script recomputes mega_score from existing patent fields:
  num_claims, num_pages, applicants, inventors, ipc_codes — no PDF
  re-extraction needed. Runs in ~30 seconds.

Usage:
  cd C:\\Users\\Som\\MEGA-PATENT-DISCOVERY-BW\\backend
  python repair_mega_scores.py
"""
from pymongo import MongoClient, UpdateOne
from collections import Counter

MONGO_URL = "mongodb+srv://mega_admin:9ZXXVWWjI3WBPuqt@cluster0.s0lvb2s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"


def calculate_mega_score(patent: dict) -> int:
    """Same formula as weekly_publish.py — keep in sync."""
    claims = patent.get("num_claims", 0) or 0
    pages = patent.get("num_pages", 0) or 0
    claims_score = min(claims * 2.5, 50)
    pages_score = min(pages * 0.8, 40)
    bonus = 0
    if len(patent.get("applicants", []) or []) > 1:
        bonus += 3
    if len(patent.get("inventors", []) or []) > 1:
        bonus += 3
    if patent.get("ipc_codes"):
        bonus += 4
    return int(claims_score + pages_score + bonus)


def main():
    print("Connecting to Atlas...")
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    client.admin.command("ping")
    db = client.patent_db
    print("Connected.\n")

    # Quick stats before repair
    total = db.patents.count_documents({})
    mega_before = db.patents.count_documents({"mega_score": {"$gte": 65}})
    has_score = db.patents.count_documents({"mega_score": {"$exists": True}})
    print(f"BEFORE repair:")
    print(f"  Total patents:        {total:,}")
    print(f"  Has mega_score field: {has_score:,}")
    print(f"  Score >= 65 (MEGA):   {mega_before:,}")
    print()

    # Sample a patent to see what we're dealing with
    sample = db.patents.find_one({})
    if sample:
        print("Sample patent fields available:")
        relevant = {k: v for k, v in sample.items() if k in (
            "application_no", "mega_score", "is_mega",
            "num_claims", "num_pages", "applicants", "inventors", "ipc_codes"
        )}
        for k, v in relevant.items():
            if isinstance(v, list):
                print(f"  {k}: list of {len(v)} ({v[:2]}...)")
            else:
                print(f"  {k}: {v} ({type(v).__name__})")
        print()

    print("Recomputing mega_score for all patents...")
    cursor = db.patents.find({}, {
        "_id": 1, "application_no": 1, "num_claims": 1, "num_pages": 1,
        "applicants": 1, "inventors": 1, "ipc_codes": 1,
    })

    bulk_ops = []
    score_distribution = Counter()
    new_mega_count = 0
    processed = 0
    batch_size = 500

    for patent in cursor:
        score = calculate_mega_score(patent)
        is_mega = score >= 65
        if is_mega:
            new_mega_count += 1

        # Bucket scores for reporting
        bucket = (score // 10) * 10
        score_distribution[bucket] += 1

        bulk_ops.append(UpdateOne(
            {"_id": patent["_id"]},
            {"$set": {"mega_score": score, "is_mega": is_mega}}
        ))

        if len(bulk_ops) >= batch_size:
            db.patents.bulk_write(bulk_ops, ordered=False)
            processed += len(bulk_ops)
            print(f"  Processed {processed:,} patents...")
            bulk_ops = []

    if bulk_ops:
        db.patents.bulk_write(bulk_ops, ordered=False)
        processed += len(bulk_ops)

    print(f"\nProcessed {processed:,} patents total.\n")

    # Update journal records with corrected mega_count
    print("Updating journal records with corrected counts...")
    journals = list(db.journals.find({}, {"journal_no": 1}))
    for j in journals:
        journal_no = j["journal_no"]
        total_in_journal = db.patents.count_documents({"journal_no": journal_no})
        mega_in_journal = db.patents.count_documents({
            "journal_no": journal_no,
            "mega_score": {"$gte": 65}
        })
        db.journals.update_one(
            {"journal_no": journal_no},
            {"$set": {
                "total_patents": total_in_journal,
                "mega_count": mega_in_journal,
            }}
        )
        print(f"  Journal {journal_no}: total={total_in_journal:,}, mega={mega_in_journal:,}")

    print()

    # Final stats
    mega_after = db.patents.count_documents({"mega_score": {"$gte": 65}})
    ultra = db.patents.count_documents({"mega_score": {"$gte": 90}})
    print("AFTER repair:")
    print(f"  Total patents:        {total:,}")
    print(f"  MEGA (score >= 65):   {mega_after:,}")
    print(f"  ULTRA (score >= 90):  {ultra:,}")
    print()

    print("Score distribution (rounded to nearest 10):")
    for bucket in sorted(score_distribution.keys()):
        count = score_distribution[bucket]
        bar = "#" * min(int(count / max(score_distribution.values()) * 50), 50)
        print(f"  {bucket:3d}-{bucket+9:3d}: {count:6,}  {bar}")

    client.close()
    print("\nDONE.")


if __name__ == "__main__":
    main()
