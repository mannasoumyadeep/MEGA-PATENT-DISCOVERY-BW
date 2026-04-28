"""
Patent Journal Extraction Dashboard - FastAPI Backend
Migrated from Flask/SQLite to FastAPI/MongoDB
"""

import asyncio
import json
import logging
import os
import re
import threading
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
import requests
from bs4 import BeautifulSoup

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import Select, WebDriverWait
    HAS_SELENIUM = True
except ImportError:
    HAS_SELENIUM = False

# Configuration
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
DOWNLOADS_DIR = DATA_DIR / "downloads"
for d in [DATA_DIR, DOWNLOADS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/")
DB_NAME = "patent_db"

IPO_BASE_URL = "https://search.ipindia.gov.in"
IPO_JOURNAL_URL = f"{IPO_BASE_URL}/IPOJournal/Journal/Patent"
IPO_DOWNLOAD_URL = f"{IPO_BASE_URL}/IPOJournal/Journal/ViewJournal"

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("patent_backend")

# FastAPI app
app = FastAPI(title="Patent Journal API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB client
client: Optional[AsyncIOMotorClient] = None
db = None

# Job tracking (in-memory for v1)
JOBS: Dict[str, dict] = {}
JOBS_LOCK = threading.Lock()

# Import services
from services import (
    scrape_journals_http,
    download_pdf_direct,
    download_pdfs_selenium,
    extract_patents_from_pdf,
    determine_pub_type_from_filename,
)


@app.on_event("startup")
async def startup_db():
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Create indexes
    await db.journals.create_index("journal_no", unique=True)
    await db.patents.create_index("application_no", unique=True)
    await db.patents.create_index("journal_no")
    await db.patents.create_index("field")
    await db.patents.create_index("city")
    await db.patents.create_index("state")
    
    log.info("MongoDB connected and indexes created")


@app.on_event("shutdown")
async def shutdown_db():
    if client:
        client.close()


# Pydantic models
class DownloadRequest(BaseModel):
    journal_no: str
    force: bool = False


# ─── API ROUTES ────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "db": str(MONGO_URL),
        "time": datetime.utcnow().isoformat(),
        "services": {
            "pdfplumber": HAS_PDFPLUMBER,
            "selenium": HAS_SELENIUM,
        }
    }


@app.get("/api/journals")
async def list_journals(refresh: str = "0", full: str = "0", limit: int = 200):
    """List available journals"""
    
    # Check if refresh needed
    if refresh in ["1", "full"] or await db.journals.count_documents({}) == 0:
        log.info(f"Refreshing journals (full={full == '1'})...")
        journals = await scrape_journals_http()
        
        if journals:
            # Upsert journals
            for j in journals:
                await db.journals.update_one(
                    {"journal_no": j["journal_no"]},
                    {"$set": {
                        **j,
                        "scraped_at": datetime.utcnow()
                    }},
                    upsert=True
                )
    
    # Fetch journals
    cursor = db.journals.find({}).limit(limit)
    journals = await cursor.to_list(length=limit)
    
    # Format response
    result = []
    for j in journals:
        result.append({
            "journal_no": j["journal_no"],
            "pub_date": j.get("pub_date", ""),
            "status": j.get("status", "available"),
            "patents_count": j.get("patents_count", 0),
            "has_local": bool(j.get("part1_local")),
            "has_download": bool(j.get("part1_filename") or j.get("part2_filename")),
            "processed_at": j.get("processed_at"),
        })
    
    # Sort by date
    result.sort(key=lambda x: x["pub_date"], reverse=True)
    
    # Add upcoming journal
    next_fri = datetime.utcnow() + timedelta(days=(4 - datetime.utcnow().weekday()) % 7 or 7)
    result.insert(0, {
        "journal_no": "UPCOMING",
        "pub_date": next_fri.strftime("%d/%m/%Y"),
        "status": "upcoming",
        "patents_count": 0,
        "has_local": False,
        "has_download": False,
        "processed_at": None,
    })
    
    return {"journals": result, "total": len(result)}


@app.post("/api/journals/download")
async def download_journal(req: DownloadRequest, background_tasks: BackgroundTasks):
    """Start background job to download and process journal"""
    journal_no = req.journal_no.strip()
    if not journal_no:
        raise HTTPException(400, "journal_no required")
    
    # Update or create journal
    await db.journals.update_one(
        {"journal_no": journal_no},
        {"$set": {"status": "queued"}},
        upsert=True
    )
    
    # Create job
    job_id = str(uuid.uuid4())
    with JOBS_LOCK:
        JOBS[job_id] = {
            "job_id": job_id,
            "journal_no": journal_no,
            "status": "running",
            "progress": 0,
            "message": "Queued",
            "started_at": datetime.utcnow().isoformat(),
        }
    
    # Start background task
    background_tasks.add_task(run_download_job, job_id, journal_no, req.force)
    
    return {"job_id": job_id, "status": "started", "journal_no": journal_no}


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    """Get job status"""
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    
    if not job:
        raise HTTPException(404, "Job not found")
    
    return job


@app.get("/api/jobs")
async def list_jobs():
    """List all jobs"""
    with JOBS_LOCK:
        jobs = list(JOBS.values())
    
    jobs.sort(key=lambda j: j.get("started_at", ""), reverse=True)
    return {"jobs": jobs}


@app.get("/api/patents")
async def get_patents(
    journal_no: str = "",
    field: str = "",
    city: str = "",
    state: str = "",
    pub_type: str = "",
    search: str = "",
    sort: str = "num_claims",
    limit: int = 200,
    offset: int = 0,
):
    """Get patents with filtering"""
    # Build query
    query = {}
    if journal_no:
        query["journal_no"] = journal_no
    if field:
        query["field"] = field
    if city:
        query["city"] = city
    if state:
        query["state"] = state
    if pub_type:
        query["pub_type"] = pub_type
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"abstract": {"$regex": search, "$options": "i"}},
        ]
    
    # Count total
    total = await db.patents.count_documents(query)
    
    # Fetch patents
    sort_field = sort if sort in ["num_claims", "num_pages", "filing_date", "publication_date"] else "num_claims"
    cursor = db.patents.find(query).sort(sort_field, -1).skip(offset).limit(limit)
    patents = await cursor.to_list(length=limit)
    
    # Remove _id for JSON serialization
    for p in patents:
        p["id"] = str(p.pop("_id"))
    
    return {"patents": patents, "total": total, "limit": limit, "offset": offset}


@app.get("/api/stats")
async def get_stats(journal_no: str = ""):
    """Get statistics"""
    query = {"journal_no": journal_no} if journal_no else {}
    
    # Overview stats
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "avg_claims": {"$avg": "$num_claims"},
            "avg_pages": {"$avg": "$num_pages"},
            "max_claims": {"$max": "$num_claims"},
        }}
    ]
    result = await db.patents.aggregate(pipeline).to_list(length=1)
    overview = result[0] if result else {
        "total": 0, "avg_claims": 0, "avg_pages": 0, "max_claims": 0
    }
    overview.pop("_id", None)
    
    # Count unique cities, states
    cities = await db.patents.distinct("city", query)
    states = await db.patents.distinct("state", query)
    overview["cities"] = len([c for c in cities if c])
    overview["states"] = len([s for s in states if s])
    
    # Field distribution
    pipeline_field = [{"$match": query}, {"$group": {"_id": "$field", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    by_field = await db.patents.aggregate(pipeline_field).to_list(length=100)
    by_field = [{"field": item["_id"], "count": item["count"]} for item in by_field]
    
    # City distribution - with safety checks
    city_query = {**query, "city": {"$ne": "", "$exists": True}}
    pipeline_city = [
        {"$match": city_query},
        {"$group": {"_id": {"city": "$city", "state": "$state"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    by_city = await db.patents.aggregate(pipeline_city).to_list(length=20)
    by_city = [{"city": item["_id"].get("city", "Unknown"), "state": item["_id"].get("state", ""), "count": item["count"]} for item in by_city]
    
    # Pub type distribution
    pipeline_pub = [{"$match": query}, {"$group": {"_id": "$pub_type", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    by_pub_type = await db.patents.aggregate(pipeline_pub).to_list(length=10)
    by_pub_type = [{"pub_type": item["_id"], "count": item["count"]} for item in by_pub_type]
    
    return {
        "overview": overview,
        "by_field": by_field,
        "by_city": by_city,
        "by_pub_type": by_pub_type,
    }


@app.get("/api/fields")
async def get_fields():
    """Get list of fields with counts"""
    pipeline = [{"$group": {"_id": "$field", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    results = await db.patents.aggregate(pipeline).to_list(length=100)
    fields = [{"field": item["_id"], "count": item["count"]} for item in results]
    return {"fields": fields}


# ─── BACKGROUND JOB ────────────────────────────────────────────────────────────

def run_download_job(job_id: str, journal_no: str, force: bool = False):
    """
    Background job to download and process journal
    Runs in thread pool - uses sync MongoDB client
    """
    from pymongo import MongoClient
    
    # Create sync MongoDB client for background thread
    sync_client = MongoClient(MONGO_URL)
    sync_db = sync_client[DB_NAME]
    
    def update_job(progress: int, message: str, status: str = "running"):
        with JOBS_LOCK:
            JOBS[job_id].update({
                "progress": progress,
                "message": message,
                "status": status,
            })
        log.info(f"[{job_id[:8]}] {progress}% {message}")
    
    try:
        update_job(5, f"Starting Journal {journal_no}...")
        
        # Download PDFs
        update_job(10, "Downloading PDFs...")
        pdfs = download_journal_pdfs(journal_no, job_id, update_job, sync_db)
        
        if not pdfs:
            update_job(100, "Download failed", "failed")
            sync_db.journals.update_one(
                {"journal_no": journal_no},
                {"$set": {"status": "failed"}}
            )
            sync_client.close()
            return
        
        # Extract patents
        update_job(55, f"Extracting from {len(pdfs)} PDF(s)...")
        total_patents = 0
        
        for i, pdf_path in enumerate(pdfs):
            pub_type = determine_pub_type_from_filename(Path(pdf_path).name)
            patents = extract_patents_from_pdf(pdf_path, journal_no)
            
            # Store patents
            if patents:
                for patent in patents:
                    patent["pub_type"] = pub_type
                    sync_db.patents.update_one(
                        {"application_no": patent["application_no"]},
                        {"$set": patent},
                        upsert=True
                    )
                total_patents += len(patents)
            
            progress = 55 + (i + 1) * (40 // max(len(pdfs), 1))
            update_job(progress, f"Extracted {total_patents} patents...")
        
        # Update journal
        sync_db.journals.update_one(
            {"journal_no": journal_no},
            {"$set": {
                "status": "processed",
                "patents_count": total_patents,
                "part1_local": pdfs[0] if pdfs else None,
                "part2_local": pdfs[1] if len(pdfs) > 1 else None,
                "processed_at": datetime.utcnow(),
            }}
        )
        
        update_job(100, f"Done! {total_patents} patents from Journal {journal_no}", "complete")
        
    except Exception as e:
        log.exception(f"Job {job_id} failed")
        update_job(100, f"Error: {str(e)}", "failed")
    finally:
        sync_client.close()


def download_journal_pdfs(journal_no: str, job_id: str, update_fn, sync_db) -> List[str]:
    """
    Download PDFs for a journal
    Returns list of downloaded file paths
    """
    jdir = DOWNLOADS_DIR / journal_no.replace("/", "_")
    jdir.mkdir(parents=True, exist_ok=True)
    
    # Get filenames from database using sync client
    journal = sync_db.journals.find_one({"journal_no": journal_no})
    
    downloaded = []
    filenames = []
    
    if journal:
        for i in [1, 2, 3]:
            fn = journal.get(f"part{i}_filename")
            if fn:
                filenames.append((i, fn))
    
    # Try direct download first
    if filenames:
        for part_num, filename in filenames:
            dest = jdir / f"journal_{journal_no.replace('/', '_')}_part{part_num}.pdf"
            
            # Skip if exists
            if dest.exists() and dest.stat().st_size > 5000:
                downloaded.append(str(dest))
                continue
            
            update_fn(15 + part_num * 15, f"Downloading Part {part_num}...")
            
            if download_pdf_direct(filename, dest):
                downloaded.append(str(dest))
                update_fn(15 + part_num * 15 + 10, f"Part {part_num} downloaded")
            else:
                log.warning(f"Part {part_num} HTTP download failed")
    
    # Fallback to Selenium if needed
    if not downloaded and HAS_SELENIUM:
        update_fn(20, "Trying browser automation...")
        downloaded = download_pdfs_selenium(journal_no, jdir, update_fn)
    
    return downloaded


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
