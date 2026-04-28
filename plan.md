# plan.md — Mega Patent Discovery Dashboard (Refactor + Strict B&W)

## 1. Objectives
- Restore frontend code health by refactoring the monolithic `App.js` into small, testable components and hooks.
- Implement a strict **Black / White / Gray-only** editorial UI (no color accents, no gradients, no emojis).
- Fix known correctness issues: React hook dependency bugs, index-as-key usage, silent catches/log noise.
- Fix data semantics: remove the “International Classification” string from applicant tags and present it as metadata (IPC).
- Keep the core workflow stable: **trigger download → job progress → processed patents visible → detail view + downloads**.

## 2. Implementation Steps

### Phase 1 — Core workflow POC validation (isolation; do not redesign yet)
User stories
1. As a user, I can trigger a journal download and see a job id immediately.
2. As a user, I can poll a job and see progress move from 0→100 with a final status.
3. As a user, I can list processed journals and see counts populate.
4. As a user, I can fetch patents filtered by `journal_no` and `mega_only=1`.
5. As a user, I can open a single patent record and see applicants + IPC codes separated.

Steps
- Add/refresh a small backend smoke test script (curl or python) that runs:
  - `GET /api/health` → ok
  - `GET /api/journals?refresh=1` → non-empty
  - `POST /api/journals/download` for one journal → job_id
  - Poll `GET /api/jobs/{job_id}` until complete
  - `GET /api/patents?limit=5&mega_only=1` → patents
- Websearch checkpoint: confirm IP India journal page selectors + download endpoints are still valid; document any drift.
- Fix any P0 backend breakage found during POC only (no refactor yet).

Deliverable: core flow proven working end-to-end before UI refactor.

---

### Phase 2 — V1 App development (refactor + strict B&W redesign)
User stories
1. As a user, I can see an empty-state onboarding explaining that data is not preloaded and how to start downloads.
2. As a user, I can browse journals, start download/upload, and see job progress inline.
3. As a user, I can filter/search/sort patents and quickly find “Mega” items.
4. As a user, I can use the India map to filter by city with clear grayscale pins.
5. As a user, I can open a patent detail drawer and read title/abstract/claims/metadata clearly.

Refactor (frontend)
- Split `src/App.js` into:
  - `src/hooks/useDashboardData.js` (journals/patents/stats/jobs + polling)
  - `src/components/dashboard/MetricsBar.js`
  - `src/components/dashboard/JournalsPanel.js`
  - `src/components/dashboard/MapPanel.js` (wraps `IndiaMap`)
  - `src/components/dashboard/PatentsPanel.js`
  - `src/components/dashboard/PatentDetailDrawer.js`
  - `src/components/modals/WelcomeDialog.js` (wrap existing `WelcomeModal` or replace)
  - `src/components/modals/UploadDialog.js`
- Apply code review fixes while refactoring:
  - Correct hook deps (no missing dependencies; no stale closures)
  - Replace index-as-key with stable keys (journal_no, application_no/id, filename)
  - Replace empty catches with `logError` + user-visible toasts where appropriate
  - Remove production console logs; keep dev-only guarded logging
  - Remove nested ternaries in render paths (extract helpers/components)

Strict B&W redesign (frontend)
- Replace all greens/colors/emojis:
  - Remove `FIELD_PALETTE`, `DENSITY_GREEN`, colored mega badges
  - Use grayscale-only badges (outline) and a single black “MEGA” marker when needed
  - Replace emoji icons with text labels or lucide-react icons
- Implement grayscale design tokens in CSS variables; update `App.css` accordingly:
  - Focus rings: black
  - Progress: black fill on light gray track
  - Selected rows/cards: black bg + white text
  - Map: white background, light gray land, dark gray borders, solid black pins w/ white halo
  - Heat/density: single black with opacity steps only
- Add `data-testid` attributes to key UI elements (metrics, journals rows, download/upload, search, sort, map, detail drawer) to enable reliable testing.

Semantic fix (applicant tags)
- Ensure applicant list shows only real applicants.
- Ensure IPC codes are displayed under metadata as `ipc_codes` (already in schema).
- If backend extraction injects classification into applicants, fix parsing in `services.py` (regex boundary) and add a small regression test.

End of phase testing
- Run frontend E2E smoke (dashboard loads, refresh journals, start job, see progress, filter patents, open detail drawer).
- Capture screenshots for verification.

---

### Phase 3 — Backend modularization + robustness (no behavior change)
User stories
1. As a developer, I can reason about scraping/downloading/extraction with small functions.
2. As a user, failed downloads show actionable errors and do not silently stall.
3. As a user, processing jobs always end in complete/failed and never “hang”.
4. As a user, repeated download requests reuse cached PDFs unless forced.
5. As a user, stats remain correct after refactors.

Steps
- Refactor high-complexity functions:
  - `services.py`: split `extract_patents_from_pdf`, `download_pdfs_selenium`, `scrape_journals_http` into helpers (parse page, parse applicants, parse ipc, infer city/state).
  - `server.py`: split `run_download_job`, `get_stats` helpers; standardize job update calls.
- Improve error handling:
  - Explicit failure states + messages; no broad except without logging.
  - Add timeouts/retries for network calls.
- Add minimal regression tests:
  - Applicant parsing (no “International Classification” in applicants)
  - IPC extraction + field mapping

End of phase testing
- Run POC script again + run a full journal job if feasible.

---

### Phase 4 — UX polish + feature hardening (optional)
User stories
1. As a user, I can download a processed journal PDF from the UI.
2. As a user, I can see a job history list with statuses.
3. As a user, I can export filtered patent results (CSV).
4. As a user, I can quickly jump via a command palette to a patent by app number.
5. As a user, the UI remains fast and readable with 500+ patents.

Steps
- Add journal PDF download links when available.
- Add job history drawer + logs.
- Add CSV export endpoint or client-side export.
- Add command palette (shadcn Command) for search/jump.
- Performance pass: memoization, virtualization if needed.

## 3. Next Actions (immediate)
1. Implement and run the Phase 1 POC smoke script to verify scraping/download/job/patent retrieval still works.
2. Create new component file structure + move code out of `App.js` (no UI changes yet besides wiring).
3. Remove all emojis and replace green styles with grayscale tokens (global pass), then refine component styles.
4. Fix “International Classification” applicant bug (locate source: backend parse vs frontend mapping) and add a regression test.
5. Run frontend testing agent + screenshot verification.

## 4. Success Criteria
- UI contains **no emojis** and **no non-grayscale colors** (including borders, badges, focus, progress, map).
- `App.js` reduced to a thin composition layer; core logic moved to hook/components.
- React hook dependency warnings eliminated; stable keys used for lists; no silent catch blocks.
- Applicants list is semantically correct; IPC appears only in metadata.
- Core workflow works reliably: empty DB → user triggers download → job progresses → patents populate → detail drawer renders correctly.
