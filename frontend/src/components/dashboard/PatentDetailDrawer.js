function getMegaBadge(score) {
  if (score >= 85) return { label: 'ULTRA', weight: 700 };
  if (score >= 75) return { label: 'MEGA+', weight: 600 };
  if (score >= 65) return { label: 'MEGA', weight: 600 };
  return null;
}

export function PatentDetailDrawer({ patent, onClose }) {
  if (!patent) return null;

  const badge = getMegaBadge(patent.mega_score);

  return (
    <div
      data-testid="patent-detail-drawer"
      className={`slide-panel${patent ? ' open' : ''}`}
    >
      <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto' }}>
        <button
          onClick={onClose}
          className="panel-close"
          data-testid="patent-detail-close-button"
        >
          ✕
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span
                className="field-pill"
                style={{
                  background: 'transparent',
                  border: '1px solid #dedede',
                  color: '#dedede',
                }}
              >
                {patent.field}
              </span>
              {badge && (
                <span
                  className="mega-badge"
                  style={{
                    background: '#fff',
                    color: '#111',
                    fontSize: 12,
                    fontWeight: badge.weight,
                  }}
                >
                  {badge.label}
                </span>
              )}
              <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: "'Libre Baskerville', serif",
                    fontSize: 32,
                    fontWeight: 700,
                    color: '#fff',
                    lineHeight: 1,
                  }}
                >
                  {patent.mega_score}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: '#7a7a7a',
                    letterSpacing: '0.06em',
                  }}
                >
                  MEGA SCORE
                </div>
              </div>
            </div>
            <h2
              data-testid="patent-detail-title"
              style={{
                fontFamily: "'Libre Baskerville', serif",
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1.5,
                color: '#fff',
                marginBottom: 16,
              }}
            >
              {patent.title}
            </h2>
            <p style={{ fontSize: 13, lineHeight: 1.8, color: '#cfcfcf', marginBottom: 20 }}>
              {patent.abstract || 'No abstract available.'}
            </p>
            {patent.applicants?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: '#7a7a7a',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  Applicants
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {patent.applicants
                    .filter((a) => !a.toLowerCase().includes('classification'))
                    .map((a, i) => (
                      <span
                        key={`applicant-${i}`}
                        style={{
                          fontSize: 11,
                          background: '#1a1a1a',
                          padding: '4px 10px',
                          borderRadius: 3,
                          color: '#cfcfcf',
                        }}
                      >
                        {a}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              ['Application No.', patent.application_no],
              ['Filing Date', patent.filing_date],
              ['Published', patent.publication_date],
              ['Claims', Math.round(patent.num_claims || 0)],
              ['Pages', patent.num_pages],
              ['IPC Codes', patent.ipc_codes?.slice(0, 3).join(', ') || '-'],
              ['City', patent.city || 'Unknown'],
              ['State', patent.state || 'Unknown'],
              ['Journal', patent.journal_no],
              ['Type', patent.pub_type],
            ].map(([label, val]) => (
              <div key={label}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                    color: '#7a7a7a',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: 3,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: '#dedede',
                    lineHeight: 1.4,
                  }}
                >
                  {val || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
