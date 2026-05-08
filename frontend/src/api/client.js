/**
 * MEGA Patent Discovery — API Client v3.3
 * Adds: getAllApplicantsIndex, getAllFieldsIndex for browse-all views
 * Fixed: handles `mega_patents` vs `patents` field naming
 */
const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

async function request(path, opts = {}) {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`[API] ${path}:`, err.message);
    throw err;
  }
}

export const api = {
  health: () => request('/api/health'),
  settings: () => request('/api/settings'),

  listJournals: ({ refresh = '0', limit = 300 } = {}) =>
    request(`/api/journals?refresh=${refresh}&limit=${limit}`),

  listPatents: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    });
    return request(`/api/patents?${params.toString()}`);
  },

  megaPatents: ({ limit = 10, offset = 0 } = {}) =>
    request(`/api/mega-patents?limit=${limit}&offset=${offset}`),

  stats: ({ journal_no = '' } = {}) =>
    request(`/api/stats${journal_no ? `?journal_no=${encodeURIComponent(journal_no)}` : ''}`),

  fields: () => request('/api/fields'),
};

// ============================================
// CLIENT-SIDE FILTERING & SEARCH
// ============================================

const APPLICANT_BLACKLIST_RX = [
  /^priority/i, /^filing/i, /^document/i, /^date/i, /^international/i,
  /^patent of addition/i, /^divisional/i, /^na$/i, /^n\/?a\b/i,
  /^classification/i, /^name of/i, /^address of/i, /^\(\d+\)/,
  /^\d{2}\/\d{2}\/\d{4}$/, /^\d+\/\d+$/, /^[a-h]\d{2}[a-z]?\s*\d/i,
];

function isJunkApplicant(name) {
  if (!name || name.length < 3 || name.length > 200) return true;
  return APPLICANT_BLACKLIST_RX.some((rx) => rx.test(name));
}

export async function getTopApplicants(limit = 5, journal_no = '') {
  const filters = { limit: 500, sort: 'mega_score', mega_only: '1' };
  if (journal_no) filters.journal_no = journal_no;
  const { patents = [] } = await api.listPatents(filters);

  const counts = new Map();
  patents.forEach((p) => {
    (p.applicants || []).forEach((a) => {
      if (!a) return;
      const clean = a.trim();
      if (isJunkApplicant(clean)) return;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    });
  });

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    topApplicants: sorted.slice(0, limit).map(([name, count], i) => ({
      rank: i + 1, name, count,
    })),
    totalApplicants: counts.size,
  };
}

export async function getEmergingTechnologies(limit = 5) {
  const { by_field = [] } = await api.stats();
  const meaningful = by_field.filter(
    (f) => f.field && !/^(unknown|other)$/i.test(f.field)
  );
  return meaningful.slice(0, limit).map((f) => ({
    name: f.field, count: f.count,
  }));
}

export async function getStateDensity() {
  const { patents = [] } = await api.listPatents({ limit: 1000, sort: 'mega_score' });
  const map = new Map();
  patents.forEach((p) => {
    const state = (p.state || '').trim();
    if (!state || state.toLowerCase() === 'unknown') return;
    if (!map.has(state)) map.set(state, { total: 0, mega: 0 });
    const entry = map.get(state);
    entry.total += 1;
    if ((p.mega_score || 0) >= 65) entry.mega += 1;
  });
  return [...map.entries()].map(([state, v]) => ({ state, ...v }));
}

// ============================================
// DRAWER QUERIES
// ============================================

export async function getPatentsByApplicant(applicantName, limit = 50) {
  const { patents = [] } = await api.listPatents({
    search: applicantName, limit, sort: 'mega_score',
  });
  return patents.filter((p) =>
    (p.applicants || []).some((a) =>
      a.toLowerCase().includes(applicantName.toLowerCase())
    )
  );
}

export async function getPatentsByField(fieldName, limit = 50) {
  const { patents = [] } = await api.listPatents({
    field: fieldName, limit, sort: 'mega_score',
  });
  return patents;
}

export async function getPatentsByState(stateName, limit = 50) {
  const { patents = [] } = await api.listPatents({
    state: stateName, limit, sort: 'mega_score',
  });
  return patents;
}

export async function searchPatents(query, limit = 30) {
  if (!query || query.trim().length < 2) return [];
  const { patents = [] } = await api.listPatents({
    search: query.trim(), limit, sort: 'mega_score',
  });
  return patents;
}

// ============================================
// INDEX VIEWS — for "browse all" drawers
// ============================================

/**
 * Fetches a wide sample (5000 patents) and aggregates ALL distinct applicants.
 * Used for "Distinct Applicants: 258" metric click.
 */
export async function getAllApplicantsIndex() {
  const { patents = [] } = await api.listPatents({ limit: 5000, sort: 'mega_score' });
  const counts = new Map();
  patents.forEach((p) => {
    (p.applicants || []).forEach((a) => {
      if (!a) return;
      const clean = a.trim();
      if (isJunkApplicant(clean)) return;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    });
  });
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.map(([name, count], i) => ({
    rank: i + 1, name, count,
  }));
}

/**
 * Returns all fields from /api/stats by_field.
 * Used for "Tech Fields: 99" metric click.
 */
export async function getAllFieldsIndex() {
  const { by_field = [] } = await api.stats();
  // Include even Unknown — user wants to see EVERYTHING
  return by_field
    .filter((f) => f.field)
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .map((f, i) => ({
      rank: i + 1, name: f.field, count: f.count || 0,
    }));
}

/**
 * Used for "MEGA Patents: 741" metric click — shows all MEGA patents directly.
 */
export async function getAllMegaPatents(limit = 200) {
  try {
    const res = await api.megaPatents({ limit });
    return res?.mega_patents || res?.patents || [];
  } catch (e) {
    const fallback = await api.listPatents({ limit, sort: 'mega_score', mega_only: '1' });
    return fallback?.patents || [];
  }
}
