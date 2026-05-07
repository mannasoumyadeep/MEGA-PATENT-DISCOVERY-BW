/* Format number with thousands separators */
export const fmt = (n) => {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-IN');
};

/* Compact number e.g. 3.7M, 18.9K */
export const fmtCompact = (n) => {
  if (n === undefined || n === null || isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

/* Parse "DD/MM/YYYY" → JS Date */
export const parseDate = (s) => {
  if (!s) return null;
  const [d, m, y] = s.split('/');
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
};

/* Format Date → "Apr 24, 2026" */
export const fmtDate = (s) => {
  const d = parseDate(s);
  if (!d) return s || '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* Format Date → "May 14" */
export const fmtDateShort = (s) => {
  const d = parseDate(s);
  if (!d) return s || '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/* Truncate text to length with ellipsis */
export const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s);

/* Title case for ALL CAPS strings */
export const titleCase = (s) => {
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
};

/* Week number from date for display */
export const weekFromDate = (s) => {
  const d = parseDate(s);
  if (!d) return null;
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
};

/* Strip "International classification" pollution from applicants */
export const cleanApplicants = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter((a) => a && !a.toLowerCase().includes('international classification')).map((a) => a.trim());
};
