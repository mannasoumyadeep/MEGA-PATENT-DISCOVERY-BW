import sys
import os
from pathlib import Path
from datetime import datetime
from pymongo import MongoClient

# Import extraction logic from your existing services.py
from services import extract_patents_from_pdf, determine_pub_type_from_filename

# ============================================
# CONFIGURATION - EDIT THESE
# ============================================
MONGO_URL = "mongodb+srv://mega_admin:9ZXXVWWjI3WBPuqt@cluster0.s0lvb2s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "patent_db"
PDF_BACKUP_DIR = Path(r"C:\patent_pdfs_backup\data\downloads")

# Map folder name to journal info
JOURNALS = {
    "44_2025": {"journal_no": "44/2025", "pub_date": "31/10/2025"},
    "16_2026": {"journal_no": "16/2026", "pub_date": "17/04/2026"},
    "17_2026": {"journal_no": "17/2026", "pub_date": "24/04/2026"},
}


def calculate_mega_score(patent):
    """MEGA score - mirrors backend/server.py logic"""
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


def main():
    print("=" * 60)
    print("MEGA PATENT - Local to Atlas Migration")
    print("=" * 60)
    
    # Connect to Atlas
    print("\n[1/4] Connecting to MongoDB Atlas...")
    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
        db = client[DB_NAME]
        client.admin.command('ping')
        print("    Connected successfully")
    except Exception as e:
        print(f"    FAILED: {e}")
        return
    
    # Create indexes
    print("\n[2/4] Creating indexes...")
    try:
        db.journals.create_index("journal_no", unique=True)
        db.patents.create_index("application_no", unique=True)
        print("    Indexes ready")
    except Exception as e:
        print(f"    Note: {e} (probably already exist)")
    
    # Process each journal
    print("\n[3/4] Processing PDFs...")
    total_patents_added = 0
    total_mega = 0
    
    for folder_name, info in JOURNALS.items():
        journal_dir = PDF_BACKUP_DIR / folder_name
        if not journal_dir.exists():
            print(f"\n  SKIP: {folder_name} - folder not found")
            continue
        
        # Find valid PDFs (skip empty/broken ones)
        pdfs = sorted([p for p in journal_dir.glob("*.pdf") 
                      if p.stat().st_size > 1000  # Skip 0-byte broken files
                      and not p.name.startswith("manual_")])
        
        if not pdfs:
            print(f"\n  SKIP: {folder_name} - no valid PDFs")
            continue
        
        print(f"\n  Journal {info['journal_no']}: {len(pdfs)} PDFs")
        
        journal_patents = 0
        journal_mega = 0
        
        for pdf_path in pdfs:
            print(f"    Extracting: {pdf_path.name}...", end=" ", flush=True)
            try:
                pub_type = determine_pub_type_from_filename(pdf_path.name)
                patents = extract_patents_from_pdf(str(pdf_path), info['journal_no'])
                
                inserted = 0
                for patent in patents:
                    if not patent.get("application_no"):
                        continue
                    
                    patent["pub_type"] = pub_type
                    patent["mega_score"] = calculate_mega_score(patent)
                    
                    if patent["mega_score"] >= 65:
                        journal_mega += 1
                    
                    db.patents.update_one(
                        {"application_no": patent["application_no"]},
                        {"$set": patent},
                        upsert=True
                    )
                    inserted += 1
                
                journal_patents += inserted
                print(f"{inserted} patents")
                
            except Exception as e:
                print(f"FAILED ({e})")
        
        # Update journal record
        db.journals.update_one(
            {"journal_no": info['journal_no']},
            {"$set": {
                "journal_no": info['journal_no'],
                "pub_date": info['pub_date'],
                "status": "processed",
                "total_patents": journal_patents,
                "mega_count": journal_mega,
                "processed_at": datetime.utcnow().isoformat()
            }},
            upsert=True
        )
        
        print(f"  Journal {info['journal_no']} complete: {journal_patents} patents ({journal_mega} MEGA)")
        total_patents_added += journal_patents
        total_mega += journal_mega
    
    # Final stats
    print("\n[4/4] Migration Complete")
    print("=" * 60)
    print(f"  Total patents inserted: {total_patents_added}")
    print(f"  MEGA patents (score >= 65): {total_mega}")
    print(f"  Atlas total: {db.patents.count_documents({})}")
    print("=" * 60)
    print("\nYour dashboard should now show real data!")
    print("Visit: https://mega-patent-discovery.vercel.app")
    
    client.close()


if __name__ == "__main__":
    main()