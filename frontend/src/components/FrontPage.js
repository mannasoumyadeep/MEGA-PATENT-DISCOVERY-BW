import React, { useCallback } from 'react';
import Topbar from './Topbar';
import Hero from './Hero';
import WeeklySnapshot from './WeeklySnapshot';
import FeaturedCarousel from './FeaturedCarousel';
import IndiaMap from './IndiaMap';
import WeeklyIntelligence from './WeeklyIntelligence';
import ApplicantsPanel from './ApplicantsPanel';
import PaidNotice from './PaidNotice';
import { useDashboardData } from '../hooks/useDashboardData';

export default function FrontPage({ drawer, setDrawer }) {
  const { data, loading, error, refresh } = useDashboardData('');

  const lastUpdated = data.health?.time
    ? new Date(data.health.time).toLocaleString('en-IN', {
        dateStyle: 'medium', timeStyle: 'short',
      })
    : null;

  const latestJournal =
    (data.journals || []).find((j) => j.status === 'processed') ||
    (data.journals || [])[0];

  const blendedStats = {
    total_patents: data.health?.stats?.total_patents ?? data.stats?.total_patents ?? 0,
    mega_patents: data.health?.stats?.mega_patents ?? data.stats?.mega_patents ?? 0,
    cities: data.stats?.cities ?? data.stateDensity?.length ?? 0,
    by_field: data.stats?.by_field ?? [],
    by_city: data.stats?.by_city ?? [],
    lead_applicant_name: data.topApplicants?.[0]?.name || null,
  };

  const openPatent = useCallback((patent) => {
    setDrawer({ mode: 'patent', patent });
  }, [setDrawer]);

  const openApplicantList = useCallback((applicantName) => {
    setDrawer({
      mode: 'list',
      filterType: 'applicant',
      filterValue: applicantName,
      filterTitle: applicantName,
      filterSubtitle: 'All patents from',
    });
  }, [setDrawer]);

  const openTechList = useCallback((techName) => {
    setDrawer({
      mode: 'list',
      filterType: 'field',
      filterValue: techName,
      filterTitle: techName,
      filterSubtitle: 'Patents in',
    });
  }, [setDrawer]);

  const openStateList = useCallback((dataStateName, displayName) => {
    setDrawer({
      mode: 'list',
      filterType: 'state',
      filterValue: dataStateName,
      filterTitle: displayName || dataStateName,
      filterSubtitle: 'Patents from',
    });
  }, [setDrawer]);

  const openSearchResults = useCallback((query) => {
    setDrawer({
      mode: 'list',
      filterType: 'search',
      filterValue: query,
      filterTitle: `"${query}"`,
      filterSubtitle: 'Search results for',
    });
  }, [setDrawer]);

  const openAllMega = useCallback(() => {
    setDrawer({ mode: 'all_mega' });
  }, [setDrawer]);

  const openApplicantIndex = useCallback(() => {
    setDrawer({ mode: 'applicant_index' });
  }, [setDrawer]);

  const openFieldIndex = useCallback(() => {
    setDrawer({ mode: 'field_index' });
  }, [setDrawer]);

  // NEW v3.5: clicking a live journal in WeeklyIntelligence opens its MEGA patents
  const openJournal = useCallback((journal) => {
    setDrawer({
      mode: 'list',
      filterType: 'journal',
      filterValue: journal.journal_no,
      filterTitle: `Journal ${journal.journal_no}`,
      filterSubtitle: `MEGA patents from`,
    });
  }, [setDrawer]);

  return (
    <main className="canvas">
      <Topbar onSearch={openSearchResults} />

      {error && (
        <div className="error-banner">
          Backend error: {error}.{' '}
          <button onClick={refresh} className="error-retry">Retry</button>
        </div>
      )}

      <Hero stats={blendedStats} latestJournal={latestJournal} />

      <WeeklySnapshot
        stats={blendedStats}
        journals={data.journals}
        totalApplicants={data.totalApplicants}
        lastUpdated={lastUpdated}
        onMegaClick={openAllMega}
        onApplicantsClick={openApplicantIndex}
        onFieldsClick={openFieldIndex}
      />

      <FeaturedCarousel
        patents={data.featured}
        onPatentClick={openPatent}
      />

      <div className="main-grid">
        <IndiaMap
          stateDensity={data.stateDensity}
          onStateClick={openStateList}
        />

        <WeeklyIntelligence
          journals={data.journals}
          selectedJournal={latestJournal?.journal_no}
          onJournalClick={openJournal}
        />

        <ApplicantsPanel
          topApplicants={data.topApplicants}
          emergingTech={data.emergingTech}
          selectedJournal={latestJournal?.journal_no}
          onApplicantClick={openApplicantList}
          onTechClick={openTechList}
        />
      </div>

      <PaidNotice />

      {loading && <div className="loading-toast">Loading…</div>}
    </main>
  );
}
