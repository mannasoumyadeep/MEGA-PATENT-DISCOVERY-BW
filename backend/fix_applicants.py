#!/usr/bin/env python3
"""
Migration script to remove 'International classification' from existing applicants
"""
import os
import re
from pymongo import MongoClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/")
DB_NAME = "patent_db"

def main():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Find patents with classification in applicants
    patents = db.patents.find({"applicants": {"$exists": True}})
    
    fixed_count = 0
    for patent in patents:
        applicants = patent.get("applicants", [])
        original_len = len(applicants)
        
        # Filter out classification text
        cleaned = [a for a in applicants if not re.search(r"(?:international\s+)?classification", a, re.IGNORECASE)]
        
        if len(cleaned) < original_len:
            db.patents.update_one(
                {"_id": patent["_id"]},
                {"$set": {"applicants": cleaned}}
            )
            fixed_count += 1
    
    print(f"✓ Fixed {fixed_count} patents")
    client.close()

if __name__ == "__main__":
    main()
