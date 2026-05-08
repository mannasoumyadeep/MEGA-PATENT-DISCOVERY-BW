import { useEffect, useState, useCallback } from 'react';
import { api, getTopApplicants, getEmergingTechnologies, getStateDensity } from '../api/client';

const DEFAULT_SETTINGS = {
  reimbursement_amount: 849,
  reimbursement_currency: 'INR',
  reimbursement_label: 'Reimbursement Collected',
};

/**
 * Fetch mega patents with field-name compatibility AND fallback to /api/patents.
 * Backend can return either { mega_patents: [...] } or { patents: [...] }.
 */
async function fetchFeatured(limit = 10) {
  try {
    const res = await api.megaPatents({ limit });
    // Backend returns "mega_patents" (correct field). Older versions returned "patents".
    const list = res?.mega_patents || res?.patents || [];
    if (list.length > 0) return list;
  } catch (e) {
    console.warn('[Featured] /api/mega-patents failed:', e.message);
  }
  // Fallback: hit /api/patents with mega_only filter
  try {
    const fallback = await api.listPatents({ limit, sort: 'mega_score', mega_only: '1' });
    return fallback?.patents || [];
  } catch (e) {
    console.error('[Featured] Fallback also failed:', e.message);
    return [];
  }
}

export function useDashboardData(selectedJournal = '') {
  const [data, setData] = useState({
    health: null,
    settings: DEFAULT_SETTINGS,
    journals: [],
    stats: null,
    featured: [],
    topApplicants: [],
    totalApplicants: 0,
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
      const [
        health,
        settings,
        journalsRes,
        stats,
        featured,
        applicantsResult,
        emergingTech,
        stateDensity,
      ] = await Promise.all([
        api.health().catch(() => null),
        api.settings().catch(() => DEFAULT_SETTINGS),
        api.listJournals().catch(() => ({ journals: [], next_journal: null })),
        api.stats({ journal_no: selectedJournal }).catch(() => null),
        fetchFeatured(10),
        getTopApplicants(5, selectedJournal).catch(() => ({ topApplicants: [], totalApplicants: 0 })),
        getEmergingTechnologies(5).catch(() => []),
        getStateDensity().catch(() => []),
      ]);

      setData({
        health,
        settings: settings || DEFAULT_SETTINGS,
        journals: journalsRes.journals || journalsRes || [],
        nextJournalDate: journalsRes.next_journal || null,
        stats,
        featured,
        topApplicants: applicantsResult.topApplicants || [],
        totalApplicants: applicantsResult.totalApplicants || 0,
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
