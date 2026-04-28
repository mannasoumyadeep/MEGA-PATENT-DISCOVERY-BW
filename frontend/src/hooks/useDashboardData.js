import { useState, useEffect, useCallback, useMemo } from 'react';

const API = process.env.REACT_APP_BACKEND_URL || '';

export function useDashboardData() {
  const [journals, setJournals] = useState([]);
  const [patents, setPatents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState({});
  const [activeJournal, setActiveJournal] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [focusField, setFocusField] = useState('All');
  const [megaOnly, setMegaOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('mega_score');

  // Load journals
  const loadJournals = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const url = `${API}/api/journals${refresh ? '?refresh=1' : ''}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('Failed to fetch journals');

      const d = await r.json();
      const sorted = (d.journals || []).sort((a, b) => {
        if (a.journal_no === 'UPCOMING') return -1;
        if (b.journal_no === 'UPCOMING') return 1;
        const dateA = a.pub_date.split('/').reverse().join('');
        const dateB = b.pub_date.split('/').reverse().join('');
        return dateB.localeCompare(dateA);
      });
      setJournals(sorted);
    } catch (error) {
      console.error('Failed to load journals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load patents
  const loadPatents = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '500', sort: sortBy });
      if (activeJournal) params.set('journal_no', activeJournal);
      if (focusField && focusField !== 'All') params.set('field', focusField);
      if (selectedCity) params.set('city', selectedCity);
      if (search) params.set('search', search);
      if (megaOnly) params.set('mega_only', '1');

      const url = `${API}/api/patents?${params}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('Failed to fetch patents');

      const d = await r.json();
      setPatents(d.patents || []);
    } catch (error) {
      console.error('Failed to load patents:', error);
    }
  }, [activeJournal, focusField, selectedCity, search, sortBy, megaOnly]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const url = `${API}/api/stats${activeJournal ? `?journal_no=${activeJournal}` : ''}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('Failed to fetch stats');

      const d = await r.json();
      setStats(d);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [activeJournal]);

  // Initial load
  useEffect(() => {
    loadJournals();
  }, [loadJournals]);

  useEffect(() => {
    loadPatents();
  }, [loadPatents]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Job polling
  useEffect(() => {
    const running = Object.values(jobs).filter((j) => j.status === 'running');
    if (!running.length) return;

    const pollJobs = async () => {
      for (const job of running) {
        try {
          const r = await fetch(`${API}/api/jobs/${job.job_id}`);
          if (!r.ok) continue;

          const d = await r.json();
          setJobs((prev) => ({ ...prev, [job.journal_no]: d }));

          if (d.status === 'complete') {
            loadJournals();
            loadPatents();
            loadStats();
          }
        } catch (error) {
          console.error('Job polling error:', error);
        }
      }
    };

    const id = setInterval(pollJobs, 2000);
    return () => clearInterval(id);
  }, [jobs, loadJournals, loadPatents, loadStats]);

  const startDownload = useCallback(async (journal_no) => {
    try {
      const r = await fetch(`${API}/api/journals/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journal_no }),
      });

      if (!r.ok) throw new Error('Download failed');

      const d = await r.json();
      setJobs((prev) => ({ ...prev, [journal_no]: { ...d, status: 'running', progress: 0 } }));
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed: ' + error.message);
    }
  }, []);

  const fieldCounts = useMemo(() => {
    const c = {};
    patents.forEach((p) => {
      c[p.field] = (c[p.field] || 0) + 1;
    });
    return c;
  }, [patents]);

  const clearFilters = useCallback(() => {
    setSelectedCity(null);
    setFocusField('All');
    setSearch('');
  }, []);

  return {
    journals,
    patents,
    stats,
    loading,
    jobs,
    activeJournal,
    selectedCity,
    focusField,
    megaOnly,
    search,
    sortBy,
    fieldCounts,
    setActiveJournal,
    setSelectedCity,
    setFocusField,
    setMegaOnly,
    setSearch,
    setSortBy,
    setJobs,
    loadJournals,
    loadPatents,
    loadStats,
    startDownload,
    clearFilters,
  };
}
