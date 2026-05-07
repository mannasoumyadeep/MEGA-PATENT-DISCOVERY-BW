import React, { useState } from 'react';
import Topbar from './Topbar';
import Hero from './Hero';
import WeeklySnapshot from './WeeklySnapshot';
import FeaturedCarousel from './FeaturedCarousel';
import IndiaMap from './IndiaMap';
import WeeklyIntelligence from './WeeklyIntelligence';
import ApplicantsPanel from './ApplicantsPanel';
import PaidNotice from './PaidNotice';
import { useDashboardData } from '../hooks/useDashboardData';

const STATIC_WHATSNEW = [
  { date: 'NOV 06', text: 'Editorial scoring v2.1 — claim depth and applicant credibility weights rebalanced' },
  { date: 'NOV 03', text: 'Expanded coverage: 12-month historical journal backfill in progress' },
  { date: 'OCT 28', text: 'Database cleanup: removed 2,341 duplicate applicant records across journals' },
];

export default function FrontPage() {
  const [selectedJournal, setSelectedJournal] = useState('');
  const { data, loading, error, refresh } = useDashboardData(selectedJournal);

  const lastUpdated = data.health?.time
    ? new Date(data.health.time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  // Latest processed journal for hero brief
  const latestJournal = (data.journals || []).find((j) => j.status === 'processed') || (data.journals || [])[0];

  // Computed stats: blend health + stats endpoints
  const blendedStats = {
    total_patents: data.health?.stats?.total_patents ?? data.stats?.total_patents ?? 0,
    mega_patents: data.health?.stats?.mega_patents ?? data.stats?.mega_patents ?? 0,
    cities: data.stats?.cities ?? 0,
    avg_claims: data.stats?.avg_claims ?? 0,
    avg_pages: data.stats?.avg_pages ?? 0,
    by_field: data.stats?.by_field ?? [],
    by_city: data.stats?.by_city ?? [],
    applicants_count: data.topApplicants?.length || '—',
  };

  return (
    <main className="canvas">
      <Topbar onSearch={(q) => console.log('Search:', q)} />

      {error && (
        <div style={{ padding: 14, background: '#FFF3F3', border: '1px solid #F0C0C0', marginBottom: 20, fontSize: 12, color: '#A03030' }}>
          Backend error: {error}. <button onClick={refresh} style={{ textDecoration: 'underline', color: '#A03030' }}>Retry</button>
        </div>
      )}

      <Hero
        stats={blendedStats}
        latestJournal={latestJournal}
        onAboutClick={() => alert('Editorial methodology coming soon')}
        onBriefClick={() => alert('Full brief coming soon')}
      />

      <WeeklySnapshot
        stats={blendedStats}
        journals={data.journals}
        lastUpdated={lastUpdated}
      />

      <FeaturedCarousel
        patents={data.featured}
        onViewAll={() => alert('All MEGA patents page coming soon')}
      />

      <div className="main-grid">
        <IndiaMap
          stateDensity={data.stateDensity}
          onViewMap={() => alert('Full map view coming soon')}
        />

        <WeeklyIntelligence
          journals={data.journals}
          selectedJournal={selectedJournal || latestJournal?.journal_no}
          onSelectJournal={setSelectedJournal}
          onViewAll={() => alert('All weeks page coming soon')}
        />

        <ApplicantsPanel
          topApplicants={data.topApplicants}
          emergingTech={data.emergingTech}
          whatsNew={STATIC_WHATSNEW}
          selectedJournal={selectedJournal || latestJournal?.journal_no}
          onViewAll={() => alert('Full applicants page coming soon')}
        />
      </div>

      <PaidNotice onLearnMore={() => alert('Pricing page coming soon')} />

      {loading && (
        <div style={{ position: 'fixed', top: 16, right: 16, background: '#0A0A0A', color: '#FFF', padding: '8px 14px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', borderRadius: 2 }}>
          Loading…
        </div>
      )}
    </main>
  );
}
