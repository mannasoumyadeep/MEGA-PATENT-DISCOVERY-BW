/**
 * MEGA Patent Discovery — API Client
 * All HTTP calls to the FastAPI backend live here.
 * Backend URL is read from REACT_APP_BACKEND_URL (Vercel env var).
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

/* ============================================
   PUBLIC API
   ============================================ */

export const api = {
  // System
  health: () => request('/api/health'),

  // Journals
  listJournals: ({ refresh = '0', limit = 300 } = {}) =>
    request(`/api/journals?refresh=${refresh}&limit=${limit}`),

  // Patents
  listPatents: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    });
    return request(`/api/patents?${params.toString()}`);
  },

  megaPatents: ({ limit = 10, offset = 0 } = {}) =>
    request(`/api/mega-patents?limit=${limit}&offset=${offset}`),

  // Stats
  stats: ({ journal_no = '' } = {}) =>
    request(`/api/stats${journal_no ? `?journal_no=${encodeURIComponent(journal_no)}` : ''}`),

  // Fields
  fields: () => request('/api/fields'),

  // Jobs
  job: (id) => request(`/api/jobs/${id}`),
  jobs: () => request('/api/jobs'),
};

/* ============================================
   DERIVED HELPERS
   client-side aggregation since the backend
   doesn't yet expose dedicated endpoints
   ============================================ */

export async function getTopApplicants(limit = 5, journal_no = '') {
  const filters = { limit: 500, sort: 'mega_score', mega_only: '1' };
  if (journal_no) filters.journal_no = journal_no;
  const { patents = [] } = await api.listPatents(filters);

  const counts = new Map();
  patents.forEach((p) => {
    (p.applicants || []).forEach((a) => {
      if (!a) return;
      const clean = a.trim();
      if (!clean || clean.toLowerCase().includes('international classification')) return;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count], i) => ({ rank: i + 1, name, count }));
}

export async function getEmergingTechnologies(limit = 5) {
  const { by_field = [] } = await api.stats();
  const total = by_field.reduce((s, f) => s + (f.count || 0), 0) || 1;
  return by_field
    .slice(0, limit)
    .map((f) => ({
      name: f.field || 'Unspecified',
      count: f.count,
      share: Math.round((f.count / total) * 100),
    }));
}

export async function getStateDensity() {
  // Pull a wide sample, group by state
  const { patents = [] } = await api.listPatents({ limit: 1000, sort: 'mega_score' });
  const map = new Map();
  patents.forEach((p) => {
    const state = (p.state || '').trim();
    if (!state || state.toLowerCase() === 'unknown') return;
    if (!map.has(state)) map.set(state, { total: 0, mega: 0, top_city: '' });
    const entry = map.get(state);
    entry.total += 1;
    if ((p.mega_score || 0) >= 65) entry.mega += 1;
  });
  return [...map.entries()].map(([state, v]) => ({ state, ...v }));
}
