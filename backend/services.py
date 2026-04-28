"""
Service functions for patent extraction
Porting from original backend.py
"""

import os
import re
import time
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import datetime

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

log = logging.getLogger(__name__)

IPO_BASE_URL = "https://search.ipindia.gov.in"
IPO_JOURNAL_URL = f"{IPO_BASE_URL}/IPOJournal/Journal/Patent"
IPO_DOWNLOAD_URL = f"{IPO_BASE_URL}/IPOJournal/Journal/ViewJournal"

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}

# Patent extraction patterns
RE_APP_NO = re.compile(r'Application\s+No[.\s]*(\d{6,15})\s*A', re.IGNORECASE)
RE_FILE_DATE = re.compile(r'Date of filing of Application\s*[:\-]\s*(\d{2}/\d{2}/\d{4})', re.IGNORECASE)
RE_PUB_DATE = re.compile(r'Publication\s*Date\s*[:\-]\s*(\d{2}/\d{2}/\d{4})', re.IGNORECASE)
RE_TITLE = re.compile(r'Title of the invention\s*[:\-]\s*(.+?)(?=\n?\s*\(\d{2}\))', re.DOTALL | re.IGNORECASE)
RE_PAGES = re.compile(r'No\.\s*of\s*Pages\s*[:\-]\s*(\d+)', re.IGNORECASE)
RE_CLAIMS = re.compile(r'No\.\s*of\s*Claims\s*[:\-]\s*(\d+)', re.IGNORECASE)
RE_ABSTRACT_START = re.compile(r'\(57\)\s*Abstract\s*[:\-]?\s*', re.IGNORECASE)
IPC_FULL_RE = re.compile(r'([A-H]\d{2}[A-Z])\s*(\d+/\d+)', re.IGNORECASE)
IPC_NUMBER_RE = re.compile(r'\d+/\d+')

# Field mappings
IPC_SECTIONS = {
    "A": "Human Necessities", "B": "Performing Operations",
    "C": "Chemistry & Metallurgy", "D": "Textiles & Paper",
    "E": "Fixed Constructions", "F": "Mechanical Engineering",
    "G": "Physics", "H": "Electricity"
}

IPC_CLASSES = {
    "A01": "Agriculture", "A61": "Medical/Veterinary", "A63": "Sports/Games",
    "B01": "Physical/Chemical Processes", "B29": "Plastics Working",
    "B33": "Additive Manufacturing", "B82": "Nano-Technology",
    "C07": "Organic Chemistry", "C08": "Polymers",
    "C10": "Petroleum/Fuels", "C12": "Biochemistry/Microbiology",
    "C25": "Electrolytic Processes", "F25": "Refrigeration/Cooling",
    "F02": "Combustion Engines", "G06": "Computing/AI",
    "G01": "Measuring/Testing", "G16": "ICT Applications",
    "H01": "Basic Electric Elements", "H02": "Electric Power",
    "H04": "Communications"
}

CITY_STATE_MAP = {
    "mumbai": ("Mumbai", "Maharashtra"), "pune": ("Pune", "Maharashtra"),
    "nagpur": ("Nagpur", "Maharashtra"), "delhi": ("New Delhi", "Delhi"),
    "new delhi": ("New Delhi", "Delhi"), "gurugram": ("Gurugram", "Haryana"),
    "noida": ("Noida", "Uttar Pradesh"), "bengaluru": ("Bengaluru", "Karnataka"),
    "bangalore": ("Bengaluru", "Karnataka"), "chennai": ("Chennai", "Tamil Nadu"),
    "hyderabad": ("Hyderabad", "Telangana"), "kolkata": ("Kolkata", "West Bengal"),
    "ahmedabad": ("Ahmedabad", "Gujarat"), "chandigarh": ("Chandigarh", "Punjab"),
    "jaipur": ("Jaipur", "Rajasthan"), "kochi": ("Kochi", "Kerala"),
}

# Pub type mapping (corrected)
PUB_TYPE_BY_PART = {
    1: "Publication After 18 Months",
    2: "Early Publication",
    3: "Publication After 18 Months",
}


def determine_pub_type_from_filename(filename: str) -> str:
    """Infer publication type from filename"""
    f = filename.lower()
    if "1st" in f or "_part1" in f:
        return PUB_TYPE_BY_PART[1]
    if "2nd" in f or "_part2" in f:
        return PUB_TYPE_BY_PART[2]
    if "3rd" in f or "_part3" in f:
        return PUB_TYPE_BY_PART[3]
    return "Publication After 18 Months"


async def scrape_journals_http() -> List[Dict]:
    """Scrape journal list via HTTP"""
    journals = []
    try:
        resp = requests.get(IPO_JOURNAL_URL, headers=BROWSER_HEADERS, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        
        table = soup.find("table", {"id": "Journal"}) or soup.find("table")
        if not table:
            return []
        
        for row in table.find_all("tr")[1:]:
            cells = row.find_all("td")
            if len(cells) < 5:
                continue
            
            journal_no = cells[1].get_text(strip=True)
            pub_date = cells[2].get_text(strip=True)
            
            if not journal_no or not re.match(r'^\d+/\d{4}$', journal_no):
                continue
            
            # Extract filenames
            filenames = []
            for form in cells[4].find_all("form"):
                inp = form.find("input", {"name": "FileName"})
                btn = form.find("button")
                if inp:
                    fn = inp.get("value", "").strip()
                    lbl = btn.get_text(strip=True) if btn else ""
                    if "Design" not in lbl and fn:
                        filenames.append(fn)
            
            journals.append({
                "journal_no": journal_no,
                "pub_date": pub_date,
                "part1_filename": filenames[0] if len(filenames) > 0 else "",
                "part2_filename": filenames[1] if len(filenames) > 1 else "",
                "part3_filename": filenames[2] if len(filenames) > 2 else "",
                "part1_url": IPO_DOWNLOAD_URL,
                "part2_url": IPO_DOWNLOAD_URL,
                "source": "http",
            })
        
        log.info(f"HTTP scraped {len(journals)} journals")
    except Exception as e:
        log.warning(f"HTTP scrape failed: {e}")
    
    return journals


def download_pdf_direct(filename: str, output_path: Path) -> bool:
    """Download PDF directly via POST request"""
    if not filename:
        return False
    
    try:
        headers = {
            **BROWSER_HEADERS,
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": IPO_JOURNAL_URL,
            "Accept": "application/pdf,application/octet-stream,*/*"
        }
        
        session = requests.Session()
        session.get(IPO_JOURNAL_URL, headers=BROWSER_HEADERS, timeout=15)
        
        resp = session.post(
            IPO_DOWNLOAD_URL,
            data={"FileName": filename},
            headers=headers,
            stream=True,
            timeout=300,
            allow_redirects=True
        )
        resp.raise_for_status()
        
        ct = resp.headers.get("content-type", "").lower()
        if "html" in ct and "pdf" not in ct:
            return False
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        bytes_written = 0
        with open(output_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=131072):
                if chunk:
                    f.write(chunk)
                    bytes_written += len(chunk)
        
        if bytes_written < 5000:
            output_path.unlink()
            return False
        
        log.info(f"Downloaded {output_path.name} ({bytes_written // 1024} KB)")
        return True
    except Exception as e:
        log.error(f"Direct download failed: {e}")
        return False


def download_pdfs_selenium(journal_no: str, download_dir: Path, update_fn) -> List[str]:
    """Download PDFs using Selenium browser automation"""
    if not HAS_SELENIUM:
        log.error("Selenium not available")
        return []
    
    downloaded = []
    driver = None
    
    try:
        abs_dir = str(download_dir.resolve())
        opts = Options()
        opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--window-size=1920,1080")
        opts.add_experimental_option("prefs", {
            "download.default_directory": abs_dir,
            "download.prompt_for_download": False,
            "plugins.always_open_pdf_externally": True,
        })
        
        # Use system chromedriver
        service = Service("/usr/bin/chromedriver")
        driver = webdriver.Chrome(service=service, options=opts)
        wait = WebDriverWait(driver, 40)
        
        update_fn(25, f"Opening IPO page for Journal {journal_no}...")
        driver.get(IPO_JOURNAL_URL)
        time.sleep(4)
        
        # Try to set show all
        try:
            Select(wait.until(EC.presence_of_element_located(("name", "Journal_length")))).select_by_value("-1")
            time.sleep(3)
        except:
            pass
        
        # Find target journal row
        rows = driver.find_elements(By.CSS_SELECTOR, "#Journal tbody tr[role='row']")
        target_row = None
        for row in rows:
            cells = row.find_elements(By.TAG_NAME, "td")
            if len(cells) > 1 and cells[1].text.strip() == journal_no:
                target_row = row
                break
        
        if not target_row:
            log.warning(f"Journal {journal_no} not found")
            return []
        
        # Get existing PDFs
        before_pdfs = set(f for f in os.listdir(abs_dir) if f.lower().endswith(".pdf"))
        
        # Click download buttons
        for part_idx in [1, 2]:
            try:
                forms = target_row.find_elements(By.TAG_NAME, "form")
                if part_idx <= len(forms):
                    btn = forms[part_idx - 1].find_element(By.TAG_NAME, "button")
                    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
                    time.sleep(0.5)
                    driver.execute_script("arguments[0].click();", btn)
                    
                    # Wait for download
                    deadline = time.time() + 120
                    while time.time() < deadline:
                        time.sleep(2)
                        after_pdfs = set(f for f in os.listdir(abs_dir) if f.lower().endswith(".pdf") and not f.endswith(".crdownload"))
                        new_files = after_pdfs - before_pdfs
                        if new_files:
                            new_file = download_dir / sorted(new_files)[-1]
                            downloaded.append(str(new_file))
                            before_pdfs = after_pdfs
                            update_fn(25 + part_idx * 20, f"Part {part_idx} downloaded")
                            break
            except Exception as e:
                log.warning(f"Part {part_idx} download failed: {e}")
    
    except Exception as e:
        log.error(f"Selenium download failed: {e}")
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass
    
    return downloaded


def extract_patents_from_pdf(pdf_path: str, journal_no: str) -> List[Dict]:
    """Extract patent data from PDF"""
    if not HAS_PDFPLUMBER:
        log.error("pdfplumber not available")
        return []
    
    patents = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            log.info(f"Processing {pdf_path} ({total_pages} pages)")
            
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                
                # Check if patent page
                if not re.search(r"PATENT APPLICATION PUBLICATION", text, re.IGNORECASE):
                    continue
                
                # Extract fields
                app_no_m = RE_APP_NO.search(text)
                if not app_no_m:
                    continue
                
                file_date_m = RE_FILE_DATE.search(text)
                pub_date_m = RE_PUB_DATE.search(text)
                title_m = RE_TITLE.search(text)
                pages_m = RE_PAGES.search(text)
                claims_m = RE_CLAIMS.search(text)
                
                # Extract IPC codes
                ipc_codes = []
                for m in IPC_FULL_RE.finditer(text):
                    ipc_codes.append(f"{m.group(1).upper()} {m.group(2)}")
                ipc_codes = ipc_codes[:5]  # Limit to 5
                
                # Determine field
                field = "Unknown"
                if ipc_codes:
                    cls_key = ipc_codes[0][:3].replace(" ", "").upper()
                    if cls_key in IPC_CLASSES:
                        field = IPC_CLASSES[cls_key]
                    else:
                        field = IPC_SECTIONS.get(ipc_codes[0][0].upper(), "Unknown")
                
                # Extract applicants (simplified)
                applicants = []
                app_match = re.search(r"Name of Applicant\s*[:\-]\s*(.+?)(?=Address of Applicant|\(72\))", text, re.DOTALL | re.IGNORECASE)
                if app_match:
                    app_text = app_match.group(1)
                    parts = re.split(r"\d+\)\s*", app_text)
                    for part in parts[1:]:
                        name = " ".join(part.split("\n")[0].split()).strip()
                        if len(name) > 3:
                            applicants.append(name)
                
                # Extract address for city/state
                address = ""
                city = ""
                state = ""
                addr_m = re.search(r"Address of Applicant\s*[:\-]\s*(.+?)(?=\(72\)|Name of Inventor)", text, re.DOTALL | re.IGNORECASE)
                if addr_m:
                    address = " ".join(addr_m.group(1).split())
                    # Infer city/state
                    addr_lower = address.lower()
                    for key, (c, s) in CITY_STATE_MAP.items():
                        if key in addr_lower:
                            city, state = c, s
                            break
                
                # Abstract
                abstract = ""
                abs_m = RE_ABSTRACT_START.search(text)
                if abs_m:
                    abs_text = text[abs_m.end():]
                    stop_m = re.search(r"No\.\s*of\s*Pages", abs_text, re.IGNORECASE)
                    abstract = " ".join((abs_text[:stop_m.start()] if stop_m else abs_text).split()).strip()
                
                patent = {
                    "application_no": app_no_m.group(1),
                    "journal_no": journal_no,
                    "filing_date": file_date_m.group(1) if file_date_m else "",
                    "publication_date": pub_date_m.group(1) if pub_date_m else "",
                    "title": " ".join(title_m.group(1).split()) if title_m else "",
                    "applicants": applicants,
                    "inventors": [],
                    "ipc_codes": ipc_codes,
                    "field": field,
                    "num_pages": int(pages_m.group(1)) if pages_m else 0,
                    "num_claims": int(claims_m.group(1)) if claims_m else 0,
                    "pub_type": "Publication After 18 Months",
                    "address": address,
                    "abstract": abstract,
                    "city": city,
                    "state": state,
                    "priority_country": "IN",
                    "created_at": datetime.now().isoformat(),
                }
                
                patents.append(patent)
        
        log.info(f"Extracted {len(patents)} patents from {Path(pdf_path).name}")
    except Exception as e:
        log.error(f"PDF extraction failed: {e}")
    
    return patents
