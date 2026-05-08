"""
Service functions for patent extraction
v3 — stricter applicant termination, blacklist filter, expanded IPC mapping
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

# ============================================
# REGEX PATTERNS
# ============================================
RE_APP_NO = re.compile(r'Application\s+No[.\s]*(\d{6,15})\s*A', re.IGNORECASE)
RE_FILE_DATE = re.compile(r'Date of filing of Application\s*[:\-]\s*(\d{2}/\d{2}/\d{4})', re.IGNORECASE)
RE_PUB_DATE = re.compile(r'Publication\s*Date\s*[:\-]\s*(\d{2}/\d{2}/\d{4})', re.IGNORECASE)
RE_TITLE = re.compile(r'Title of the invention\s*[:\-]\s*(.+?)(?=\n?\s*\(\d{2}\))', re.DOTALL | re.IGNORECASE)
RE_PAGES = re.compile(r'No\.\s*of\s*Pages\s*[:\-]\s*(\d+)', re.IGNORECASE)
RE_CLAIMS = re.compile(r'No\.\s*of\s*Claims\s*[:\-]\s*(\d+)', re.IGNORECASE)
RE_ABSTRACT_START = re.compile(r'\(57\)\s*Abstract\s*[:\-]?\s*', re.IGNORECASE)
IPC_FULL_RE = re.compile(r'([A-H]\d{2}[A-Z])\s*(\d+/\d+)', re.IGNORECASE)
IPC_NUMBER_RE = re.compile(r'\d+/\d+')

# Blacklist patterns for filtering out non-applicant strings that bleed into the extraction
APPLICANT_BLACKLIST_PATTERNS = [
    re.compile(r"^priority\b", re.IGNORECASE),
    re.compile(r"^filing\b", re.IGNORECASE),
    re.compile(r"^document\b", re.IGNORECASE),
    re.compile(r"^date\b", re.IGNORECASE),
    re.compile(r"^international\b", re.IGNORECASE),
    re.compile(r"^patent of addition", re.IGNORECASE),
    re.compile(r"^divisional", re.IGNORECASE),
    re.compile(r"^filing date", re.IGNORECASE),
    re.compile(r"^na$", re.IGNORECASE),
    re.compile(r"^n/?a\b", re.IGNORECASE),
    re.compile(r"^\d{2}/\d{2}/\d{4}$"),  # Pure date
    re.compile(r"^\d+/\d+$"),  # IPC number
    re.compile(r"^[a-h]\d{2}[a-z]?\s*\d", re.IGNORECASE),  # IPC code
    re.compile(r"^classification\b", re.IGNORECASE),
    re.compile(r"^\(\d+\)"),  # Field marker like "(31)"
    re.compile(r"^name of\s+(applicant|inventor|priority)", re.IGNORECASE),
    re.compile(r"^address of", re.IGNORECASE),
]


def is_blacklisted_name(name: str) -> bool:
    """Return True if the candidate string is junk, not a real name."""
    if not name or len(name) < 3 or len(name) > 200:
        return True
    for pat in APPLICANT_BLACKLIST_PATTERNS:
        if pat.search(name):
            return True
    return False


# ============================================
# FIELD MAPPINGS — EXPANDED v3 (60+ codes)
# ============================================
IPC_SECTIONS = {
    "A": "Human Necessities", "B": "Performing Operations",
    "C": "Chemistry & Metallurgy", "D": "Textiles & Paper",
    "E": "Fixed Constructions", "F": "Mechanical Engineering",
    "G": "Physics", "H": "Electricity"
}

IPC_CLASSES = {
    # A — Human Necessities
    "A01": "Agriculture", "A21": "Baking & Food Equipment", "A22": "Slaughtering",
    "A23": "Food & Beverages", "A24": "Tobacco Products", "A41": "Wearing Apparel",
    "A42": "Headwear", "A43": "Footwear", "A44": "Haberdashery & Jewelry",
    "A45": "Personal Articles", "A46": "Brushware", "A47": "Furniture & Domestic",
    "A61": "Medical/Veterinary", "A62": "Life-Saving & Fire-Fighting",
    "A63": "Sports/Games", "A99": "Other Necessities",
    # B — Performing Operations
    "B01": "Physical/Chemical Processes", "B02": "Crushing & Grinding",
    "B03": "Solid Separation", "B04": "Centrifugal Apparatus",
    "B05": "Spraying & Coating", "B06": "Mechanical Vibration",
    "B07": "Solid Separation Methods", "B08": "Cleaning Processes",
    "B09": "Waste Disposal", "B21": "Mechanical Metal-Working",
    "B22": "Casting & Powder Metallurgy", "B23": "Machine Tools",
    "B24": "Grinding & Polishing", "B25": "Hand Tools",
    "B26": "Hand Cutting Tools", "B27": "Wood/Metal Working",
    "B28": "Working Cement", "B29": "Plastics Working",
    "B30": "Presses", "B31": "Paper Working", "B32": "Layered Products",
    "B33": "Additive Manufacturing", "B41": "Printing",
    "B42": "Bookbinding", "B43": "Writing/Drawing Implements",
    "B44": "Decorative Arts", "B60": "Vehicles",
    "B61": "Railways", "B62": "Land Vehicles", "B63": "Ships",
    "B64": "Aircraft & Aviation", "B65": "Conveying & Packaging",
    "B66": "Hoisting & Lifting", "B67": "Container Filling",
    "B68": "Saddlery", "B81": "Microstructural Technology",
    "B82": "Nano-Technology",
    # C — Chemistry & Metallurgy
    "C01": "Inorganic Chemistry", "C02": "Water Treatment",
    "C03": "Glass & Mineral Wool", "C04": "Cements & Ceramics",
    "C05": "Fertilizers", "C06": "Explosives & Matches",
    "C07": "Organic Chemistry", "C08": "Polymers",
    "C09": "Dyes, Paints, Polishes", "C10": "Petroleum/Fuels",
    "C11": "Animal/Vegetable Oils", "C12": "Biochemistry/Microbiology",
    "C13": "Sugar Industry", "C14": "Skins & Leather",
    "C21": "Metallurgy of Iron", "C22": "Non-Ferrous Metallurgy",
    "C23": "Coating of Metals", "C25": "Electrolytic Processes",
    "C30": "Crystal Growth", "C40": "Combinatorial Technology",
    # D — Textiles
    "D01": "Natural & Synthetic Threads", "D02": "Yarns & Mechanical Finishing",
    "D03": "Weaving", "D04": "Braiding & Lace Making",
    "D05": "Sewing & Embroidering", "D06": "Treatment of Textiles",
    "D07": "Ropes & Cables", "D21": "Paper Making",
    # E — Fixed Constructions
    "E01": "Construction of Roads", "E02": "Hydraulic Engineering",
    "E03": "Water Supply & Sewerage", "E04": "Building",
    "E05": "Locks, Keys, Window Fittings", "E06": "Doors & Windows",
    "E21": "Earth & Rock Drilling, Mining",
    # F — Mechanical Engineering
    "F01": "Steam Engines", "F02": "Combustion Engines",
    "F03": "Hydraulic Engines", "F04": "Positive-Displacement Machines",
    "F15": "Fluid-Pressure Actuators", "F16": "Engineering Elements",
    "F17": "Storing/Distributing Gases", "F21": "Lighting",
    "F22": "Steam Generation", "F23": "Combustion Apparatus",
    "F24": "Heating, Ranges, Ventilating", "F25": "Refrigeration/Cooling",
    "F26": "Drying", "F27": "Furnaces, Kilns, Ovens",
    "F28": "Heat Exchange", "F41": "Weapons",
    "F42": "Ammunition & Blasting",
    # G — Physics
    "G01": "Measuring/Testing", "G02": "Optics",
    "G03": "Photography & Holography", "G04": "Horology",
    "G05": "Controlling & Regulating", "G06": "Computing/AI",
    "G07": "Checking-Devices", "G08": "Signalling",
    "G09": "Educating & Display", "G10": "Musical Instruments",
    "G11": "Information Storage", "G12": "Instrument Details",
    "G16": "ICT Applications", "G21": "Nuclear Physics",
    # H — Electricity
    "H01": "Basic Electric Elements", "H02": "Electric Power",
    "H03": "Basic Electronic Circuitry", "H04": "Communications",
    "H05": "Electric Techniques", "H10": "Semiconductor Devices",
    "H99": "Other Electrical",
}

# ============================================
# EXPANDED INDIAN CITY → STATE GAZETTEER
# ============================================
CITY_STATE_MAP = {
    # Maharashtra
    "mumbai": ("Mumbai", "Maharashtra"), "pune": ("Pune", "Maharashtra"),
    "nagpur": ("Nagpur", "Maharashtra"), "nashik": ("Nashik", "Maharashtra"),
    "aurangabad": ("Aurangabad", "Maharashtra"), "thane": ("Thane", "Maharashtra"),
    "navi mumbai": ("Navi Mumbai", "Maharashtra"), "kolhapur": ("Kolhapur", "Maharashtra"),
    "solapur": ("Solapur", "Maharashtra"),
    # Delhi NCR
    "delhi": ("New Delhi", "Delhi"), "new delhi": ("New Delhi", "Delhi"),
    "gurugram": ("Gurugram", "Haryana"), "gurgaon": ("Gurugram", "Haryana"),
    "noida": ("Noida", "Uttar Pradesh"), "ghaziabad": ("Ghaziabad", "Uttar Pradesh"),
    "faridabad": ("Faridabad", "Haryana"), "greater noida": ("Greater Noida", "Uttar Pradesh"),
    # Karnataka
    "bengaluru": ("Bengaluru", "Karnataka"), "bangalore": ("Bengaluru", "Karnataka"),
    "mysuru": ("Mysuru", "Karnataka"), "mysore": ("Mysuru", "Karnataka"),
    "mangaluru": ("Mangaluru", "Karnataka"), "hubli": ("Hubli", "Karnataka"),
    "belagavi": ("Belagavi", "Karnataka"), "manipal": ("Manipal", "Karnataka"),
    # Tamil Nadu
    "chennai": ("Chennai", "Tamil Nadu"), "coimbatore": ("Coimbatore", "Tamil Nadu"),
    "madurai": ("Madurai", "Tamil Nadu"), "tiruchirappalli": ("Tiruchirappalli", "Tamil Nadu"),
    "salem": ("Salem", "Tamil Nadu"), "vellore": ("Vellore", "Tamil Nadu"),
    "tirunelveli": ("Tirunelveli", "Tamil Nadu"), "erode": ("Erode", "Tamil Nadu"),
    # Telangana / Andhra
    "hyderabad": ("Hyderabad", "Telangana"), "secunderabad": ("Hyderabad", "Telangana"),
    "warangal": ("Warangal", "Telangana"), "nizamabad": ("Nizamabad", "Telangana"),
    "visakhapatnam": ("Visakhapatnam", "Andhra Pradesh"), "vizag": ("Visakhapatnam", "Andhra Pradesh"),
    "vijayawada": ("Vijayawada", "Andhra Pradesh"), "tirupati": ("Tirupati", "Andhra Pradesh"),
    "guntur": ("Guntur", "Andhra Pradesh"), "nellore": ("Nellore", "Andhra Pradesh"),
    # West Bengal
    "kolkata": ("Kolkata", "West Bengal"), "howrah": ("Howrah", "West Bengal"),
    "durgapur": ("Durgapur", "West Bengal"), "siliguri": ("Siliguri", "West Bengal"),
    "asansol": ("Asansol", "West Bengal"), "kharagpur": ("Kharagpur", "West Bengal"),
    # Gujarat
    "ahmedabad": ("Ahmedabad", "Gujarat"), "surat": ("Surat", "Gujarat"),
    "vadodara": ("Vadodara", "Gujarat"), "rajkot": ("Rajkot", "Gujarat"),
    "gandhinagar": ("Gandhinagar", "Gujarat"), "bhavnagar": ("Bhavnagar", "Gujarat"),
    "jamnagar": ("Jamnagar", "Gujarat"), "anand": ("Anand", "Gujarat"),
    # Punjab / Haryana / Chandigarh
    "chandigarh": ("Chandigarh", "Chandigarh"), "ludhiana": ("Ludhiana", "Punjab"),
    "amritsar": ("Amritsar", "Punjab"), "jalandhar": ("Jalandhar", "Punjab"),
    "patiala": ("Patiala", "Punjab"), "mohali": ("Mohali", "Punjab"),
    "panchkula": ("Panchkula", "Haryana"), "ambala": ("Ambala", "Haryana"),
    "hisar": ("Hisar", "Haryana"), "karnal": ("Karnal", "Haryana"),
    "rohtak": ("Rohtak", "Haryana"), "panipat": ("Panipat", "Haryana"),
    "sonipat": ("Sonipat", "Haryana"),
    # Rajasthan
    "jaipur": ("Jaipur", "Rajasthan"), "jodhpur": ("Jodhpur", "Rajasthan"),
    "udaipur": ("Udaipur", "Rajasthan"), "kota": ("Kota", "Rajasthan"),
    "alwar": ("Alwar", "Rajasthan"), "ajmer": ("Ajmer", "Rajasthan"),
    "bikaner": ("Bikaner", "Rajasthan"), "tijara": ("Tijara", "Rajasthan"),
    # Kerala
    "kochi": ("Kochi", "Kerala"), "ernakulam": ("Kochi", "Kerala"),
    "thiruvananthapuram": ("Thiruvananthapuram", "Kerala"),
    "trivandrum": ("Thiruvananthapuram", "Kerala"),
    "kozhikode": ("Kozhikode", "Kerala"), "calicut": ("Kozhikode", "Kerala"),
    "thrissur": ("Thrissur", "Kerala"), "kollam": ("Kollam", "Kerala"),
    "kannur": ("Kannur", "Kerala"), "palakkad": ("Palakkad", "Kerala"),
    # Uttar Pradesh
    "lucknow": ("Lucknow", "Uttar Pradesh"), "kanpur": ("Kanpur", "Uttar Pradesh"),
    "varanasi": ("Varanasi", "Uttar Pradesh"), "agra": ("Agra", "Uttar Pradesh"),
    "allahabad": ("Prayagraj", "Uttar Pradesh"), "prayagraj": ("Prayagraj", "Uttar Pradesh"),
    "meerut": ("Meerut", "Uttar Pradesh"), "bareilly": ("Bareilly", "Uttar Pradesh"),
    "moradabad": ("Moradabad", "Uttar Pradesh"), "aligarh": ("Aligarh", "Uttar Pradesh"),
    "gorakhpur": ("Gorakhpur", "Uttar Pradesh"), "saharanpur": ("Saharanpur", "Uttar Pradesh"),
    # Madhya Pradesh
    "bhopal": ("Bhopal", "Madhya Pradesh"), "indore": ("Indore", "Madhya Pradesh"),
    "gwalior": ("Gwalior", "Madhya Pradesh"), "jabalpur": ("Jabalpur", "Madhya Pradesh"),
    "ujjain": ("Ujjain", "Madhya Pradesh"), "sagar": ("Sagar", "Madhya Pradesh"),
    # Odisha
    "bhubaneswar": ("Bhubaneswar", "Odisha"), "cuttack": ("Cuttack", "Odisha"),
    "rourkela": ("Rourkela", "Odisha"), "berhampur": ("Berhampur", "Odisha"),
    # Bihar / Jharkhand
    "patna": ("Patna", "Bihar"), "gaya": ("Gaya", "Bihar"),
    "muzaffarpur": ("Muzaffarpur", "Bihar"), "bhagalpur": ("Bhagalpur", "Bihar"),
    "ranchi": ("Ranchi", "Jharkhand"), "jamshedpur": ("Jamshedpur", "Jharkhand"),
    "dhanbad": ("Dhanbad", "Jharkhand"), "bokaro": ("Bokaro", "Jharkhand"),
    # Assam / Northeast
    "guwahati": ("Guwahati", "Assam"), "dibrugarh": ("Dibrugarh", "Assam"),
    "silchar": ("Silchar", "Assam"), "shillong": ("Shillong", "Meghalaya"),
    "imphal": ("Imphal", "Manipur"), "agartala": ("Agartala", "Tripura"),
    "aizawl": ("Aizawl", "Mizoram"), "kohima": ("Kohima", "Nagaland"),
    "itanagar": ("Itanagar", "Arunachal Pradesh"), "gangtok": ("Gangtok", "Sikkim"),
    # Uttarakhand / HP / J&K
    "dehradun": ("Dehradun", "Uttarakhand"), "haridwar": ("Haridwar", "Uttarakhand"),
    "roorkee": ("Roorkee", "Uttarakhand"), "haldwani": ("Haldwani", "Uttarakhand"),
    "shimla": ("Shimla", "Himachal Pradesh"), "manali": ("Manali", "Himachal Pradesh"),
    "dharamshala": ("Dharamshala", "Himachal Pradesh"),
    "srinagar": ("Srinagar", "Jammu and Kashmir"), "jammu": ("Jammu", "Jammu and Kashmir"),
    "leh": ("Leh", "Ladakh"),
    # Chhattisgarh
    "raipur": ("Raipur", "Chhattisgarh"), "bhilai": ("Bhilai", "Chhattisgarh"),
    "bilaspur": ("Bilaspur", "Chhattisgarh"),
    # Goa / Pondicherry
    "panaji": ("Panaji", "Goa"), "margao": ("Margao", "Goa"),
    "puducherry": ("Puducherry", "Puducherry"), "pondicherry": ("Puducherry", "Puducherry"),
}

STATE_NAMES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Chandigarh", "Puducherry",
    "Andaman and Nicobar Islands", "Dadra and Nagar Haveli", "Daman and Diu", "Lakshadweep"
]

PUB_TYPE_BY_PART = {
    1: "Early Publication",
    2: "Publication After 18 Months",
    3: "Publication After 18 Months",
}


def determine_pub_type_from_filename(filename: str) -> str:
    f = filename.lower()
    if "1st" in f or "_part1" in f:
        return PUB_TYPE_BY_PART[1]
    if "2nd" in f or "_part2" in f:
        return PUB_TYPE_BY_PART[2]
    if "3rd" in f or "_part3" in f:
        return PUB_TYPE_BY_PART[3]
    return "Publication After 18 Months"


async def scrape_journals_http() -> List[Dict]:
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
                "journal_no": journal_no, "pub_date": pub_date,
                "part1_filename": filenames[0] if len(filenames) > 0 else "",
                "part2_filename": filenames[1] if len(filenames) > 1 else "",
                "part3_filename": filenames[2] if len(filenames) > 2 else "",
                "part1_url": IPO_DOWNLOAD_URL, "part2_url": IPO_DOWNLOAD_URL, "source": "http",
            })
        log.info(f"HTTP scraped {len(journals)} journals")
    except Exception as e:
        log.warning(f"HTTP scrape failed: {e}")
    return journals


def download_pdf_direct(filename: str, output_path: Path) -> bool:
    if not filename:
        return False
    try:
        headers = {**BROWSER_HEADERS, "Content-Type": "application/x-www-form-urlencoded",
                   "Referer": IPO_JOURNAL_URL,
                   "Accept": "application/pdf,application/octet-stream,*/*"}
        session = requests.Session()
        session.get(IPO_JOURNAL_URL, headers=BROWSER_HEADERS, timeout=15)
        resp = session.post(IPO_DOWNLOAD_URL, data={"FileName": filename},
                            headers=headers, stream=True, timeout=300, allow_redirects=True)
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
        try:
            from webdriver_manager.chrome import ChromeDriverManager
            service = Service(ChromeDriverManager().install())
        except ImportError:
            service = Service("/usr/bin/chromedriver")
        driver = webdriver.Chrome(service=service, options=opts)
        wait = WebDriverWait(driver, 40)
        update_fn(25, f"Opening IPO page for Journal {journal_no}...")
        driver.get(IPO_JOURNAL_URL)
        time.sleep(4)
        try:
            Select(wait.until(EC.presence_of_element_located(("name", "Journal_length")))).select_by_value("-1")
            time.sleep(3)
        except:
            pass
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
        before_pdfs = set(f for f in os.listdir(abs_dir) if f.lower().endswith(".pdf"))
        for part_idx in [1, 2]:
            try:
                forms = target_row.find_elements(By.TAG_NAME, "form")
                if part_idx <= len(forms):
                    btn = forms[part_idx - 1].find_element(By.TAG_NAME, "button")
                    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
                    time.sleep(0.5)
                    driver.execute_script("arguments[0].click();", btn)
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


# ============================================
# THE BIG ONE — patched extraction with strict termination + blacklist
# ============================================
def extract_patents_from_pdf(pdf_path: str, journal_no: str) -> List[Dict]:
    """Extract patent data from PDF — v3 with strict applicant termination and blacklist."""
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
                if not re.search(r"PATENT APPLICATION PUBLICATION", text, re.IGNORECASE):
                    continue

                app_no_m = RE_APP_NO.search(text)
                if not app_no_m:
                    continue

                file_date_m = RE_FILE_DATE.search(text)
                pub_date_m = RE_PUB_DATE.search(text)
                title_m = RE_TITLE.search(text)
                pages_m = RE_PAGES.search(text)
                claims_m = RE_CLAIMS.search(text)

                ipc_codes = []
                for m in IPC_FULL_RE.finditer(text):
                    ipc_codes.append(f"{m.group(1).upper()} {m.group(2)}")
                seen = set()
                ipc_codes = [c for c in ipc_codes if not (c in seen or seen.add(c))][:5]

                # Field categorization
                field = "Unknown"
                if ipc_codes:
                    cls_key = ipc_codes[0][:3].replace(" ", "").upper()
                    if cls_key in IPC_CLASSES:
                        field = IPC_CLASSES[cls_key]
                    else:
                        field = IPC_SECTIONS.get(ipc_codes[0][0].upper(), "Other")

                # ============ APPLICANTS — strict termination + blacklist ============
                applicants = []
                # Stop at ANY of these markers — covers all common patent layouts
                app_match = re.search(
                    r"\(71\)\s*Name of Applicant\s*[:\-]?\s*(.+?)"
                    r"(?=Address of Applicant|\(72\)\s*Name of Inventor|\(72\)|\(51\)|\(31\)|"
                    r"\(32\)|\(33\)|\(86\)|\(87\)|\(61\)|\(62\)|\(57\)|"
                    r"Priority\s+Document|Priority\s+Date|Filing\s+Date|"
                    r"International\s+Application|Patent of Addition|Divisional)",
                    text, re.DOTALL | re.IGNORECASE
                )
                if app_match:
                    app_text = app_match.group(1)
                    parts = re.split(r"\d+\)\s*", app_text)
                    for part in parts[1:]:
                        name = " ".join(part.split("\n")[0].split()).strip()
                        name = re.sub(r"[,;:]+$", "", name).strip()
                        # Apply blacklist filter
                        if not is_blacklisted_name(name):
                            applicants.append(name)

                # ============ INVENTORS — same strict approach ============
                inventors = []
                inv_match = re.search(
                    r"\(72\)\s*Name of Inventor\s*[:\-]?\s*(.+?)"
                    r"(?=\(31\)|\(32\)|\(33\)|\(86\)|\(87\)|\(61\)|\(62\)|\(57\)|"
                    r"Priority\s+Document|Priority\s+Date|Filing\s+Date|"
                    r"International\s+Application|Patent of Addition|Divisional)",
                    text, re.DOTALL | re.IGNORECASE
                )
                if inv_match:
                    inv_text = inv_match.group(1)
                    parts = re.split(r"\d+\)\s*", inv_text)
                    for part in parts[1:]:
                        name = " ".join(part.split("\n")[0].split()).strip()
                        name = re.sub(r"[,;:]+$", "", name).strip()
                        if not is_blacklisted_name(name) and len(name) < 80:
                            inventors.append(name)
                inventors = inventors[:10]

                # ============ ADDRESS + CITY/STATE ============
                address = ""
                city = ""
                state = ""
                addr_m = re.search(
                    r"Address of Applicant\s*[:\-]?\s*(.+?)"
                    r"(?=\(72\)|\(51\)|\(31\)|\(32\)|\(33\)|\(86\)|"
                    r"Name of Inventor|Priority\s+Document|Filing\s+Date)",
                    text, re.DOTALL | re.IGNORECASE
                )
                if addr_m:
                    raw_addr = addr_m.group(1)
                    raw_addr = re.sub(r"\b[A-H]\d{2}[A-Z]?\s*\d+/\d+\b", "", raw_addr)
                    raw_addr = re.sub(r"\b\d+/\d+\b", "", raw_addr)
                    raw_addr = re.sub(r"\bclassification\b", "", raw_addr, flags=re.IGNORECASE)
                    address = " ".join(raw_addr.split()).strip()
                    address = re.sub(r"[,\s]+$", "", address)

                    addr_lower = address.lower()
                    for key, (c, s) in CITY_STATE_MAP.items():
                        if re.search(rf"\b{re.escape(key)}\b", addr_lower):
                            city, state = c, s
                            break
                    if not state:
                        for state_name in STATE_NAMES:
                            if re.search(rf"\b{re.escape(state_name)}\b", address, re.IGNORECASE):
                                state = state_name
                                break

                # ============ ABSTRACT ============
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
                    "inventors": inventors,
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
