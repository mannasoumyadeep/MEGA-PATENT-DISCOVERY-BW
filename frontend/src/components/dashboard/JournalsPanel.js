export function JournalsPanel({ journals, activeJournal, jobs, loading, onToggleJournal, onStartDownload, onUploadClick, onRefresh }) {
  return (
    <div
      data-testid="journals-panel"
      style={{
        width: 210,
        flexShrink: 0,
        borderRight: '1px solid #dedede',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #dedede',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#5a5a5a',
          }}
        >
          IPO Journals
        </span>
        <button
          className="btn"
          onClick={() => onRefresh(true)}
          disabled={loading}
          data-testid="journals-refresh-button"
        >
          {loading ? '⟳' : '↻'} Refresh
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {journals.map((j) => {
          const job = jobs[j.journal_no];
          const isActive = activeJournal === j.journal_no;
          const isRunning = job && job.status === 'running';
          const isProcessed = j.status === 'processed';

          return (
            <div
              key={j.journal_no}
              data-testid="journal-row"
              className={`journal-row${isActive ? ' sel' : ''}`}
              onClick={() => isProcessed && onToggleJournal(j.journal_no)}
              style={{ cursor: isProcessed ? 'pointer' : 'default' }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isProcessed ? '#111' : j.status === 'upcoming' ? '#5a5a5a' : '#cfcfcf',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 10, color: isActive ? '#fff' : '#111' }}>
                  No. {j.journal_no}
                </div>
                <div style={{ fontSize: 9, color: isActive ? '#cfcfcf' : '#7a7a7a', marginTop: 1 }}>
                  {j.pub_date}
                </div>
                {j.mega_patents_count > 0 && (
                  <div
                    style={{
                      fontSize: 8,
                      color: isActive ? '#dedede' : '#111',
                      marginTop: 2,
                      fontWeight: 600,
                    }}
                  >
                    {j.mega_patents_count} MEGA
                  </div>
                )}
              </div>
              {isRunning ? (
                <div style={{ textAlign: 'right', minWidth: 50 }}>
                  <div style={{ fontSize: 9, color: '#5a5a5a', marginBottom: 2 }}>{job.progress || 0}%</div>
                  <div className="progress-bar" style={{ width: 50, height: 3 }}>
                    <div className="progress-fill" style={{ width: `${job.progress || 0}%`, background: '#111' }} />
                  </div>
                </div>
              ) : j.status !== 'processed' && j.status !== 'upcoming' ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn-mini primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartDownload(j.journal_no);
                    }}
                    data-testid="journal-download-button"
                  >
                    ↓
                  </button>
                  <button
                    className="btn-mini"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUploadClick(j.journal_no);
                    }}
                    data-testid="journal-upload-button"
                  >
                    ↑
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
