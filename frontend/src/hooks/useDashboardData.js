import { useEffect, useState, useCallback } from 'react';
import { api, getTopApplicants, getEmergingTechnologies, getStateDensity } from '../api/client';

/**
 * Master hook: pulls everything the front page needs in one shot.
 * Returns { loading, error, data, refresh }.
 */
export function useDashboardData(selectedJournal = '') {
  const [data, setData] = useState({
    health: null,
    journals: [],
    stats: null,
    featured: [],
    topApplicants: [],
    emergingTech: [],
    stateDensity: [],
    nextJournalDate: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [health, journalsRes, stats, featuredRes, topApplicants, emergingTech, stateDensity] = await Promise.all([
        api.health().catch(() => null),
        api.listJournals().catch(() => ({ journals: [], next_journal: null })),
        api.stats({ journal_no: selectedJournal }).catch(() => null),
        api.megaPatents({ limit: 10 }).catch(() => ({ patents: [] })),
        getTopApplicants(5, selectedJournal).catch(() => []),
        getEmergingTechnologies(5).catch(() => []),
        getStateDensity().catch(() => []),
      ]);

      setData({
        health,
        journals: journalsRes.journals || journalsRes || [],
        nextJournalDate: journalsRes.next_journal || null,
        stats,
        featured: featuredRes.patents || [],
        topApplicants,
        emergingTech,
        stateDensity,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedJournal]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refresh: load };
}
