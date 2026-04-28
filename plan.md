# plan.md — Patent Journal Data Extraction Dashboard

## 1) Objectives
- Deliver a **public, no-auth** dashboard where any user can:
  - See latest **IP India Patent Journals**
  - Trigger **download + PDF extraction** jobs with **live progress**
  - Browse/search/filter extracted patent data
  - View stats + visualizations (India city map, field heatmap)
- Migrate existing working logic (Flask/SQLite) to **FastAPI + MongoDB**, keeping the workflow resilient to website changes.
- Optimize for long-running workloads: **idempotent jobs, caching, resume/retry, minimal re-downloads**.

---

## 2) Implementation Steps

### Phase 1 — Core Workflow POC (Isolation: scrape → download → extract → persist → query)
**Why:** Scraping + Selenium + large PDFs + regex extraction are the failure-prone core. Do not proceed until stable.

**User stories (POC)**
1. As a user, I can request the journal list and see at least N recent journals.
2. As a user, I can trigger a job for a journal and get a job_id immediately.
3. As a user, I can poll job status and see % progress + stage messages.
4. As a user, I can download at least one journal part and store it locally.
5. As a user, I can extract patents from the PDF and query them back via API.

**Steps**
1. Web research (best practices)
   - Confirm current IPO journal page behavior (DataTables, form POST download, anti-bot patterns).
   - Validate best-practice Selenium download patterns in headless Chrome (download dir prefs, waits).
2. Create standalone POC scripts (no app yet)
   - `poc_scrape_journals.py`: requests+BS4 first; fallback to Selenium extraction if needed.
   - `poc_download_pdf.py`: direct POST download using `FileName`; fallback Selenium click-download.
   - `poc_extract_pdf.py`: pdfplumber extraction on a real downloaded PDF; verify regexes.
   - `poc_mongo_roundtrip.py`: insert journals/patents into Mongo; query with filters.
3. Define canonical data model (minimal fields first)
   - Journal: `journal_no, pub_date, filenames{part1,part2,part3}, local_paths, status, patents_count, scraped_at, processed_at`
   - Patent: `application_no (unique), journal_no, title, applicants[], inventors[], ipc_codes[], field, city,state, pub_type, num_pages,num_claims, filing_date, publication_date, abstract, priority_*`
4. POC acceptance loop
   - Run end-to-end for 1 journal: scrape → download (>=1 PDF) → extract (>=50 patents) → persist → query.
   - Fix selectors/regex until consistent.
5. Document POC learnings
   - Stable selectors, retry policy, expected download sizes/time, known failure modes.

**Exit criteria**
- One journal fully processed successfully in the target environment using Selenium + pdfplumber.
- Mongo contains patents; API-like queries can filter by journal/city/field and return results.

---

### Phase 2 — V1 App Development (FastAPI + MongoDB + React/Vite)
**User stories (V1)**
1. As a user, I can see a list of journals with statuses (available/queued/running/processed/failed).
2. As a user, I can click “Get” to start processing a journal and track progress live.
3. As a user, I can select a processed journal and browse patents sorted by claims/pages/date.
4. As a user, I can filter by field and city and search across title/abstract/applicants.
5. As a user, I can view insights (top cities, field distribution, pub type split) for all journals or a selected journal.

**Backend (FastAPI)**
1. Project setup
   - `server/` FastAPI app, env config, CORS, logging.
   - Mongo connection (Motor) + indexes (unique `application_no`, `journal_no`, `city`, `field`).
2. Core services (ported from backend.py)
   - Scraper service: HTTP scrape first; Selenium list scrape fallback.
   - Downloader service: direct POST by filename; Selenium fallback; disk caching per journal.
   - Extractor service: pdfplumber parse; corrected `pub_type` mapping by part.
3. Background job system (in-memory for v1)
   - Endpoints: `POST /api/journals/{jno}/process`, `GET /api/jobs/{job_id}`, `GET /api/jobs`.
   - Job states + progress stages: queued → downloading → extracting → saving → complete/failed.
   - Idempotency: if journal already processed and files exist, skip re-download unless `force=1`.
4. API endpoints for UI
   - `GET /api/health`
   - `GET /api/journals?refresh=0|1|full`
   - `GET /api/patents` (filters + pagination + sort; export flag)
   - `GET /api/stats?journal_no=`
   - `GET /api/fields`

**Frontend (React/Vite)**
1. Integrate existing UI (patent_watch.jsx → App)
   - Replace hardcoded ngrok API with `import.meta.env.VITE_BACKEND_URL`.
   - Ensure journals panel can start jobs + poll job status.
2. Data states
   - Empty DB: show “No processed journals yet — click Get to start.”
   - Running job: show progress bar + message per journal.
   - Error states: failed job surfaced with retry.
3. Keep V1 scope tight
   - Map + heatmap + list + insights from existing component, wired to FastAPI.

**End of Phase 2 testing (mandatory)**
- One full E2E run: refresh journals → start job → completion → browse patents → filters/search/stats.
- Run a second job to validate concurrency and caching behavior.

---

### Phase 3 — Hardening, Optimizations, and Quality
**User stories (Hardening)**
1. As a user, I can safely retry a failed journal processing job without duplicate patents.
2. As a user, I can resume processing if a server restart occurs (at least detect partial downloads).
3. As a user, I see fast load times because processed results are cached and indexed.
4. As a user, I can export filtered results (CSV/XLSX) for a journal.
5. As a user, I can process older journals (pagination/full scrape) reliably.

**Work items**
1. Robustness
   - Retries with backoff for downloads; checksum/size thresholds.
   - Selector resilience: multiple strategies + fallback logic.
   - Better parsing validation (application_no presence, de-dup).
2. Performance
   - Avoid reprocessing: store `processed_hash` (filenames + size) and skip if unchanged.
   - Bulk writes to Mongo; streaming extraction progress updates every N pages.
   - Add key indexes + query projections.
3. Job reliability upgrades
   - Persist jobs to Mongo (replace in-memory) for restart survival.
   - Add simple job lock per journal (prevent duplicate concurrent processing).
4. UX improvements
   - “Force reprocess” toggle; last processed timestamp.
   - Better empty/error messaging in UI.

**End of Phase 3 testing (mandatory)**
- E2E test: run job → restart server mid-way → recover (or fail gracefully) → retry completes.
- Load test basic: list journals + fetch patents with filters quickly.

---

## 3) Next Actions (Immediate)
1. Build and run Phase 1 POC scripts against the live IPO site; iterate until stable.
2. Finalize Mongo schemas + required indexes based on POC data.
3. Implement FastAPI services by directly porting proven POC code paths.
4. Wire UI to `VITE_BACKEND_URL` and validate full E2E job flow.

---

## 4) Success Criteria
- A fresh install (empty DB) allows any user to:
  - Refresh journals list and trigger processing for a selected journal
  - Observe real-time progress until completion
  - Browse/search/filter extracted patents and view stats/visualizations
- Processing is **idempotent** (no duplicate patents), reasonably fast (cached downloads), and resilient (retryable failures).
- Core endpoints return correct data and the UI handles empty/running/failed/processed states cleanly.
