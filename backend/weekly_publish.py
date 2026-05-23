"""
MEGA Patent Discovery — Weekly Publisher
========================================

A single-command tool to publish a journal week's worth of patents to Atlas.

DEFAULT BEHAVIOR (single-week mode):
  Wipes the entire patents + journals collection, then publishes ONLY the
  specified week. Your dashboard will show only this journal's data.

ROLLING MODE:
  Use --keep-last N to retain the latest N journals instead of wiping all.

WORKFLOW:
  1. Tries to download PDFs from IP India website (Selenium)
  2. Falls back to local PDFs if download fails
  3. Extracts patents using patched services.py
  4. Pushes clean data to Atlas
  5. Reports stats

USAGE:
  python weekly_publish.py 17/2026                    # single-week (default)
  python weekly_publish.py 18/2026 --keep-last 4     # rolling 4-week window
  python weekly_publish.py 18/2026 --no-download     # skip download, use disk only
  python weekly_publish.py 18/2026 --dry-run         # show what would happen, don't write

LOCATION:
  Place in: C:\\Users\\Som\\MEGA-PATENT-DISCOVERY-BW\\backend\\
"""

import argparse
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from pymongo import MongoClient

# Use patched extraction logic from services.py
from services import (
    extract_patents_from_pdf,
    determine_pub_type_from_filename,
    download_pdfs_selenium,
    HAS_SELENIUM,
)

# ============================================
# CONFIG
# ============================================
MONGO_URL = "mongodb+srv://mega_admin:9ZXXVWWjI3WBPuqt@cluster0.s0lvb2s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "patent_db"
PDF_BASE_DIR = Path(r"C:\patent_pdfs_backup\data\downloads")


# ============================================
# UTILITIES
# ============================================
def banner(text: str, char: str = "="):
    print(f"\n{char * 64}")
    print(f"  {text}")
    print(f"{char * 64}")


def status(msg: str, indent: int = 2):
    print(f"{' ' * indent}{msg}")


def calculate_mega_score(patent: dict) -> int:
    """MEGA score 0-100 based on claims, pages, and metadata richness."""
    claims = patent.get("num_claims", 0)
    pages = patent.get("num_pages", 0)
    claims_score = min(claims * 2.5, 50)
    pages_score = min(pages * 0.8, 40)
    bonus = 0
    if len(patent.get("applicants", [])) > 1:
        bonus += 3
    if len(patent.get("inventors", [])) > 1:
        bonus += 3
    if patent.get("ipc_codes"):
        bonus += 4
    return int(claims_score + pages_score + bonus)


def validate_journal_no(journal_no: str) -> bool:
    return bool(re.match(r"^\d+/\d{4}$", journal_no))


# ============================================
# CONNECT TO ATLAS
# ============================================
def connect_atlas() -> tuple:
    status("Connecting to MongoDB Atlas...")
    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
        client.admin.command("ping")
        db = client[DB_NAME]
        # Ensure indexes (idempotent)
        try:
            db.patents.create_index("application_no", unique=True)
            db.journals.create_index("journal_no", unique=True)
            db.patents.create_index("journal_no")
            db.patents.create_index("mega_score")
            db.patents.create_index("state")
        except Exception:
            pass  # Already exist
        status("Connected.")
        return client, db
    except Exception as e:
        status(f"FAILED: {e}")
        sys.exit(1)


# ============================================
# RETENTION POLICY
# ============================================
def apply_retention(db, current_journal: str, keep_last: int, dry_run: bool):
    """
    Decide what to delete based on retention strategy.
    Returns (patents_deleted, journals_deleted).
    """
    if keep_last <= 1:
        # Single-week mode: wipe everything except the new journal we're about to insert
        patents_query = {"journal_no": {"$ne": current_journal}}
        journals_query = {"journal_no": {"$ne": current_journal}}
        mode = f"single-week (only {current_journal})"
    else:
        # Rolling window: keep the N most recent processed journals (by pub_date)
        # Plus always keep the current journal we're about to publish
        existing = list(db.journals.find(
            {"status": "processed"},
            {"journal_no": 1, "pub_date": 1}
        ).sort("pub_date", -1).limit(keep_last - 1))

        keep_set = {j["journal_no"] for j in existing} | {current_journal}
        patents_query = {"journal_no": {"$nin": list(keep_set)}}
        journals_query = {"journal_no": {"$nin": list(keep_set)}}
        mode = f"rolling window (keep last {keep_last})"

    p_count = db.patents.count_documents(patents_query)
    j_count = db.journals.count_documents(journals_query)

    status(f"Retention mode: {mode}")
    status(f"  Will delete: {p_count} patents, {j_count} journals")

    if dry_run:
        status("  [DRY RUN] Skipping delete.")
        return 0, 0

    if p_count == 0 and j_count == 0:
        return 0, 0

    p_result = db.patents.delete_many(patents_query)
    j_result = db.journals.delete_many(journals_query)
    return p_result.deleted_count, j_result.deleted_count


# ============================================
# DOWNLOAD PDFs (Selenium with progress callback)
# ============================================
def download_pdfs(journal_no: str) -> list:
    """Try to download PDFs for the given journal from IP India."""
    if not HAS_SELENIUM:
        status("Selenium not installed — cannot auto-download.")
        return []

    folder = PDF_BASE_DIR / journal_no.replace("/", "_")
    folder.mkdir(parents=True, exist_ok=True)
    status(f"Attempting to download Journal {journal_no} from IP India...")

    def update_fn(progress, msg):
        status(f"  [{progress}%] {msg}", indent=4)

    try:
        downloaded = download_pdfs_selenium(journal_no, folder, update_fn)
        if downloaded:
            status(f"Downloaded {len(downloaded)} PDF(s)")
        else:
            status("No PDFs downloaded (journal may not be on IP India homepage).")
        return downloaded
    except Exception as e:
        status(f"Download error: {e}")
        return []


# ============================================
# DISK FALLBACK
# ============================================
def find_local_pdfs(journal_no: str) -> list:
    folder = PDF_BASE_DIR / journal_no.replace("/", "_")
    if not folder.exists():
        return []
    pdfs = sorted([
        p for p in folder.glob("*.pdf")
        if p.stat().st_size > 1000
        and not p.name.startswith("manual_")
    ])
    return pdfs


# ============================================
# CORE: PROCESS + INSERT
# ============================================
def process_journal(db, journal_no: str, pdfs: list, dry_run: bool) -> dict:
    if not pdfs:
        return {"error": "No PDFs to process"}

    status(f"Processing {len(pdfs)} PDF(s) for Journal {journal_no}...")
    total_patents = 0
    mega_count = 0
    start = time.time()
    pub_date = ""

    for pdf_path in pdfs:
        pdf_path = Path(pdf_path)
        status(f"  → {pdf_path.name}", indent=4)

        try:
            pub_type = determine_pub_type_from_filename(pdf_path.name)
            patents = extract_patents_from_pdf(str(pdf_path), journal_no)
            status(f"    Extracted {len(patents)} patents", indent=4)

            if dry_run:
                # Skip insert in dry run mode
                if patents:
                    pub_date = patents[0].get("publication_date", "")
                continue

            inserted = 0
            for patent in patents:
                if not patent.get("application_no"):
                    continue
                patent["pub_type"] = pub_type
                patent["mega_score"] = calculate_mega_score(patent)
                patent["is_mega"] = patent["mega_score"] >= 65
                patent["ingested_at"] = datetime.utcnow().isoformat()
                if patent["is_mega"]:
                    mega_count += 1
                if not pub_date:
                    pub_date = patent.get("publication_date", "")

                db.patents.update_one(
                    {"application_no": patent["application_no"]},
                    {"$set": patent},
                    upsert=True
                )
                inserted += 1

            total_patents += inserted
            status(f"    Inserted {inserted} patents into Atlas", indent=4)

        except Exception as e:
            status(f"    FAILED: {e}", indent=4)

    elapsed = int(time.time() - start)

    if not dry_run:
        # Update journal record
        db.journals.update_one(
            {"journal_no": journal_no},
            {"$set": {
                "journal_no": journal_no,
                "pub_date": pub_date,
                "status": "processed",
                "total_patents": total_patents,
                "mega_count": mega_count,
                "pdf_count": len(pdfs),
                "processed_at": datetime.utcnow().isoformat(),
                "processing_seconds": elapsed,
            }},
            upsert=True
        )

    return {
        "journal_no": journal_no,
        "pdfs": len(pdfs),
        "patents": total_patents,
        "mega": mega_count,
        "seconds": elapsed,
    }


# ============================================
# FINAL STATS REPORT
# ============================================
def report_final_stats(db):
    total = db.patents.count_documents({})
    mega = db.patents.count_documents({"mega_score": {"$gte": 65}})
    cities = len([c for c in db.patents.distinct("city") if c])
    states = len([s for s in db.patents.distinct("state") if s])
    journals = list(db.journals.find({"status": "processed"}, {"_id": 0}).sort("pub_date", -1))

    banner("ATLAS STATUS AFTER PUBLISH", char="-")
    status(f"Total patents:    {total:,}")
    status(f"MEGA patents:     {mega:,} ({100*mega//max(total,1)}%)")
    status(f"Cities covered:   {cities}")
    status(f"States covered:   {states}")
    status(f"Journals in DB:   {len(journals)}")
    if journals:
        status("")
        status("Currently published:")
        for j in journals:
            status(
                f"  Journal {j['journal_no']:<10} "
                f"({j.get('pub_date', '?'):<12}) "
                f"{j.get('total_patents', 0):>5} patents, "
                f"{j.get('mega_count', 0):>4} MEGA",
                indent=4
            )


# ============================================
# MAIN
# ============================================
def main():
    parser = argparse.ArgumentParser(
        description="Publish a single weekly journal to MEGA Patent Discovery dashboard."
    )
    parser.add_argument(
        "journal_no",
        help="Journal number in WW/YYYY format (e.g., 17/2026)"
    )
    parser.add_argument(
        "--keep-last",
        type=int,
        default=1,
        help="How many journals to retain in DB. Default 1 (single-week mode)."
    )
    parser.add_argument(
        "--no-download",
        action="store_true",
        help="Skip auto-download attempt; use existing local PDFs only."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would happen without writing to Atlas."
    )
    args = parser.parse_args()

    # Validate
    if not validate_journal_no(args.journal_no):
        print(f"ERROR: Invalid journal number format '{args.journal_no}'. Use WW/YYYY (e.g., 17/2026)")
        sys.exit(1)

    banner(f"MEGA PATENT — Weekly Publisher")
    print(f"  Journal:     {args.journal_no}")
    print(f"  Retention:   {'Single-week (default)' if args.keep_last == 1 else f'Rolling, keep last {args.keep_last}'}")
    print(f"  Download:    {'Skipped (--no-download)' if args.no_download else 'Try auto-download, fall back to disk'}")
    print(f"  Mode:        {'DRY RUN — no writes' if args.dry_run else 'LIVE — will modify Atlas'}")

    # Connect
    client, db = connect_atlas()

    # Step 1: Apply retention (delete old journals)
    banner("STEP 1 — RETENTION POLICY", char="-")
    deleted_p, deleted_j = apply_retention(db, args.journal_no, args.keep_last, args.dry_run)
    if deleted_p or deleted_j:
        status(f"Deleted {deleted_p} patents, {deleted_j} journals")

    # Step 2: Acquire PDFs
    banner("STEP 2 — ACQUIRE PDFs", char="-")
    pdfs = []
    if not args.no_download:
        pdfs = download_pdfs(args.journal_no)

    if not pdfs:
        if args.no_download:
            status("Looking for PDFs on disk (download skipped)...")
        else:
            status("Falling back to disk...")
        pdfs = find_local_pdfs(args.journal_no)
        if pdfs:
            status(f"Found {len(pdfs)} PDF(s) on disk:")
            for p in pdfs:
                status(f"  {p.name} ({p.stat().st_size // 1024} KB)", indent=4)
        else:
            status(f"No PDFs found on disk either.")
            status(f"Expected location: {PDF_BASE_DIR / args.journal_no.replace('/', '_')}")
            client.close()
            sys.exit(1)

    # Step 3: Process and insert
    banner("STEP 3 — EXTRACT & PUBLISH", char="-")
    result = process_journal(db, args.journal_no, pdfs, args.dry_run)

    if "error" in result:
        status(f"ERROR: {result['error']}")
        client.close()
        sys.exit(1)

    status("")
    status(f"Journal {result['journal_no']} processed:")
    status(f"  Patents inserted: {result['patents']:,}")
    status(f"  MEGA patents:     {result['mega']:,}")
    status(f"  Time elapsed:     {result['seconds']}s ({result['seconds']//60}m {result['seconds']%60}s)")

    # Step 4: Final stats
    if not args.dry_run:
        report_final_stats(db)

    banner("DONE")
    if args.dry_run:
        status("DRY RUN complete. No changes were made to Atlas.")
        status("Re-run without --dry-run to actually publish.")
    else:
        status("Published successfully.")
        status("Refresh your dashboard to see the new data:")
        status("  https://mega-patent-discovery.vercel.app", indent=4)

    client.close()


if __name__ == "__main__":
    main()
