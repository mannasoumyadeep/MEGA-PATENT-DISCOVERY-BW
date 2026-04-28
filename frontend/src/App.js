import { useState, useCallback } from 'react';
import { useDashboardData } from './hooks/useDashboardData';
import { MetricsBar } from './components/dashboard/MetricsBar';
import { JournalsPanel } from './components/dashboard/JournalsPanel';
import { MapPanel } from './components/dashboard/MapPanel';
import { PatentsPanel } from './components/dashboard/PatentsPanel';
import { PatentDetailDrawer } from './components/dashboard/PatentDetailDrawer';
import WelcomeDialog from './components/modals/WelcomeDialog';
import UploadDialog from './components/modals/UploadDialog';
import './App.css';

export default function MegaPatentApp() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [selectedPatent, setSelectedPatent] = useState(null);
  const [uploadModal, setUploadModal] = useState(null);

  const {
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
    startDownload,
    clearFilters,
  } = useDashboardData();

  const toggleJournal = useCallback(
    (jno) => {
      setActiveJournal((prev) => (prev === jno ? null : jno));
    },
    [setActiveJournal]
  );

  const toggleCity = useCallback(
    (city) => {
      setSelectedCity((prev) => (prev === city ? null : city));
    },
    [setSelectedCity]
  );

  const toggleField = useCallback(
    (field) => {
      setFocusField((prev) => (prev === field ? 'All' : field));
    },
    [setFocusField]
  );

  const togglePatent = useCallback((patent) => {
    setSelectedPatent((prev) => (prev?.id === patent.id ? null : patent));
  }, []);

  const handleUploadStart = useCallback(
    (jobId) => {
      setJobs((prev) => ({ ...prev, [uploadModal]: { job_id: jobId, status: 'running', progress: 0 } }));
    },
    [uploadModal, setJobs]
  );

  return (
    <>
      {showWelcome && <WelcomeDialog onClose={() => setShowWelcome(false)} />}
      {uploadModal && (
        <UploadDialog journalNo={uploadModal} onClose={() => setUploadModal(null)} onUploadStart={handleUploadStart} />
      )}

      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            height: 64,
            borderBottom: '2px solid #111',
            flexShrink: 0,
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 700, color: '#111' }}>
              MEGA Patent Discovery
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: '#5a5a5a',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {activeJournal ? `Journal ${activeJournal}` : 'All Journals'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {(selectedCity || focusField !== 'All' || search) && (
              <button className="btn" onClick={clearFilters} data-testid="clear-filters-button">
                ✕ Clear Filters
              </button>
            )}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: '#111',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={megaOnly}
                onChange={(e) => setMegaOnly(e.target.checked)}
                data-testid="mega-only-checkbox"
              />
              MEGA Only
            </label>
          </div>
        </header>

        <MetricsBar stats={stats} patents={patents} activeJournal={activeJournal} loading={loading} />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <JournalsPanel
            journals={journals}
            activeJournal={activeJournal}
            jobs={jobs}
            loading={loading}
            onToggleJournal={toggleJournal}
            onStartDownload={startDownload}
            onUploadClick={setUploadModal}
            onRefresh={loadJournals}
          />

          <MapPanel
            patents={patents}
            selectedCity={selectedCity}
            fieldCounts={fieldCounts}
            focusField={focusField}
            onCityClick={toggleCity}
            onFieldClick={toggleField}
          />

          <PatentsPanel
            patents={patents}
            loading={loading}
            search={search}
            sortBy={sortBy}
            selectedCity={selectedCity}
            focusField={focusField}
            megaOnly={megaOnly}
            onSearchChange={setSearch}
            onSortChange={setSortBy}
            onPatentClick={togglePatent}
            selectedPatent={selectedPatent}
          />
        </div>
      </div>

      <PatentDetailDrawer patent={selectedPatent} onClose={() => setSelectedPatent(null)} />

      {/* Made with Emergent badge */}
      <div
        data-testid="made-with-emergent-badge"
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          zIndex: 40,
          borderRadius: 4,
          border: '1px solid #dedede',
          background: '#ffffff',
          padding: '6px 10px',
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#5a5a5a',
        }}
      >
        Made with Emergent
      </div>
    </>
  );
}
