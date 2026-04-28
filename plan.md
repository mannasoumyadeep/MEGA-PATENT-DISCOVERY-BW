# plan.md — Mega Patent Discovery Dashboard (Refactor + Strict B&W)

## 1. Objectives (Updated)
- ✅ **Frontend code health restored** by refactoring the monolithic `App.js` into small, testable components and a dedicated data hook.
- ✅ Implemented a strict **Black / White / Gray-only** editorial UI:
  - No color accents
  - No gradients
  - No emojis
  - Typography-driven hierarchy (serif for titles, mono for metrics/IDs, sans for body)
- ✅ Addressed key code review items:
  - Hook dependency correctness
  - Stable list keys
  - Removed `transition: all`
  - Reduced render complexity by extracting components
- ✅ Fixed data semantics: removed “International Classification” from applicants and ensured IPC codes stay in metadata.
- ✅ Maintained core workflow stability: **trigger download → job progress → processed patents visible → detail view**.

## 2. Implementation Steps (Progress Reflected)

### Phase 1 — Core workflow POC validation (Completed)
User stories
1. As a user, I can trigger a journal download and see a job id immediately.
2. As a user, I can poll a job and see progress move from 0→100 with a final status.
3. As a user, I can list processed journals and see counts populate.
4. As a user, I can fetch patents filtered by `journal_no` and `mega_only=1`.
5. As a user, I can open a single patent record and see applicants + IPC codes separated.

Steps (Completed)
- ✅ Added and ran backend smoke test:
  - `GET /api/health` → ok
  - `GET /api/journals?refresh=1` → non-empty
  - `GET /api/patents` / `GET /api/stats` → ok
- ✅ Confirmed journal download + extraction pipeline works; verified job progress updates.
- ✅ Identified applicant semantic bug (“International classification” in applicants) during validation.

Deliverable (Completed): core flow proven working end-to-end prior to UI refactor.

---

### Phase 2 — V1 App development (refactor + strict B&W redesign) (Completed)
User stories
1. As a user, I can see an onboarding/welcome modal explaining that data is not preloaded and how to start downloads.
2. As a user, I can browse journals, start download/upload, and see job progress inline.
3. As a user, I can filter/search/sort patents and quickly find “Mega” items.
4. As a user, I can use the India map to filter by city with clear grayscale pins.
5. As a user, I can open a patent detail drawer and read title/abstract/metadata clearly.

Refactor (frontend) — Completed
- ✅ Split `src/App.js` into modular structure:
  - `src/hooks/useDashboardData.js`
  - `src/components/dashboard/MetricsBar.js`
  - `src/components/dashboard/JournalsPanel.js`
  - `src/components/dashboard/MapPanel.js`
  - `src/components/dashboard/IndiaMap.js`
  - `src/components/dashboard/PatentsPanel.js`
  - `src/components/dashboard/PatentDetailDrawer.js`
  - `src/components/modals/WelcomeDialog.js`
  - `src/components/modals/UploadDialog.js`

Code review fixes applied during refactor — Completed
- ✅ Hook dependencies corrected (no stale closures).
- ✅ Stable keys used for list rendering where applicable.
- ✅ Render logic simplified by breaking UI into components.
- ✅ Removed green theme dependencies and replaced with grayscale-only styling.
- ✅ Removed `transition: all` in CSS; replaced with targeted transitions.

Strict B&W redesign (frontend) — Completed
- ✅ Removed all green accents and color palettes.
- ✅ Removed emojis and replaced with text or monochrome SVG.
- ✅ Implemented grayscale-only UI rules:
  - Focus rings and borders use black/gray only
  - Progress bars use black fill on light gray track
  - Selected rows/cards use black background with white text
  - Map uses grayscale land + borders, black pins with white halo
  - Technology density uses opacity-only grayscale
- ✅ Added `data-testid` attributes across key UI surfaces for reliable testing.

Semantic fix (applicant tags) — Completed
- ✅ Backend extraction updated to filter out classification strings from applicants.
- ✅ Migration script executed to clean existing DB records:
  - Added `backend/fix_applicants.py`
  - Removed “International classification” from stored applicant arrays.

End of phase testing — Completed
- ✅ Frontend compiled and verified.
- ✅ Screenshot verification:
  - Welcome modal
  - Main dashboard
  - Patent detail drawer
- ✅ Testing agent run: 97% overall success.
- ✅ Follow-up fix applied for applicant semantic issue; re-verified no classification text in UI.

---

### Phase 3 — Backend modularization + robustness (Optional / Future)
Status: **Not required for current release**, recommended for maintainability.

User stories
1. As a developer, I can reason about scraping/downloading/extraction with small functions.
2. As a user, failed downloads show actionable errors and do not silently stall.
3. As a user, processing jobs always end in complete/failed and never “hang”.
4. As a user, repeated download requests reuse cached PDFs unless forced.
5. As a user, stats remain correct after refactors.

Recommended steps (Future)
- Refactor high-complexity functions:
  - `services.py`: split `extract_patents_from_pdf`, `download_pdfs_selenium`, `scrape_journals_http` into helpers (parse applicants, parse ipc, infer city/state).
  - `server.py`: split `run_download_job`, `get_stats` into helpers; standardize job updates.
- Improve error handling:
  - Explicit failure states + messages
  - Retries/timeouts for network calls
- Add minimal regression tests:
  - Applicant parsing never includes classification text
  - IPC extraction + field mapping correctness

End of phase testing (Future)
- Re-run smoke tests + process one full journal as a regression run.

---

### Phase 4 — UX polish + feature hardening (Optional / Future)
User stories
1. As a user, I can download a processed journal PDF from the UI.
2. As a user, I can see a job history list with statuses.
3. As a user, I can export filtered patent results (CSV).
4. As a user, I can quickly jump via a command palette to a patent by app number.
5. As a user, the UI remains fast and readable with 500+ patents.

Recommended steps
- Add journal PDF download links when available.
- Add job history drawer + logs.
- Add CSV export endpoint or client-side export.
- Add command palette for search/jump.
- Performance pass (memoization, potential list virtualization if scaling beyond current limits).

## 3. Next Actions (Immediate)
- ✅ No immediate actions required for Phase 1–2; core deliverables are complete.
- Optional next actions (if continuing):
  1. Execute Phase 3 backend modularization.
  2. Add regression tests for parsing and applicant filtering.
  3. Implement Phase 4 UX enhancements (downloads, exports, job history).

## 4. Success Criteria (Current Status)
- ✅ UI contains **no emojis** and **no non-grayscale colors** (including borders, badges, focus, progress, map).
- ✅ `App.js` reduced to a composition layer; core logic moved to `useDashboardData` hook and modular components.
- ✅ React hook dependency warnings eliminated; stable keys used; render logic simplified.
- ✅ Applicants list is semantically correct; IPC appears only in metadata.
- ✅ Core workflow works reliably: empty DB → user triggers download → job progresses → patents populate → detail drawer renders correctly.
