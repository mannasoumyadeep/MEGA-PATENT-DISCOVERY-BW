function getMegaBadge(score) {
  if (score >= 85) return { label: 'ULTRA', weight: 700 };
  if (score >= 75) return { label: 'MEGA+', weight: 600 };
  if (score >= 65) return { label: 'MEGA', weight: 600 };
  return null;
}

export function PatentsPanel({
  patents,
  loading,
  search,
  sortBy,
  selectedCity,
  focusField,
  megaOnly,
  onSearchChange,
  onSortChange,
  onPatentClick,
  selectedPatent,
}) {
  return (
    <div data-testid="patents-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        style={{
          padding: '10px 20px',
          borderBottom: '1px solid #dedede',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <input
          data-testid="patents-search-input"
          className="search-box"
          placeholder="Search patents..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ flex: 1 }}
        />
        <select
          data-testid="patents-sort-select"
          onChange={(e) => onSortChange(e.target.value)}
          value={sortBy}
          className="select-box"
        >
          <option value="mega_score">MEGA Score ↓</option>
          <option value="num_claims">Claims ↓</option>
          <option value="num_pages">Pages ↓</option>
          <option value="filing_date">Date ↓</option>
        </select>
      </div>
      <div
        style={{
          padding: '8px 20px',
          borderBottom: '1px solid #f6f6f6',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: '#7a7a7a',
          letterSpacing: '0.07em',
        }}
      >
        {patents.length} RESULT{patents.length !== 1 ? 'S' : ''}
        {selectedCity ? ` · ${selectedCity}` : ''}
        {focusField !== 'All' ? ` · ${focusField}` : ''}
        {megaOnly ? ' · MEGA ONLY' : ''}
      </div>
      <div data-testid="patents-list" style={{ flex: 1, overflowY: 'auto' }}>
        {patents.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              color: '#cfcfcf',
            }}
          >
            {loading ? 'Loading...' : 'No patents found'}
          </div>
        ) : (
          patents.map((p) => {
            const badge = getMegaBadge(p.mega_score);
            const isSel = selectedPatent?.id === p.id;
            return (
              <div
                key={p.id || p.application_no}
                data-testid="patent-list-item"
                className={`patent-card${isSel ? ' sel' : ''}`}
                onClick={() => onPatentClick(p)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span
                        className="field-pill"
                        style={{
                          background: 'transparent',
                          border: '1px solid #111',
                          color: isSel ? '#fff' : '#111',
                        }}
                      >
                        {p.field}
                      </span>
                      {badge && (
                        <span
                          className="mega-badge"
                          style={{
                            background: '#111',
                            color: '#fff',
                            fontWeight: badge.weight,
                          }}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        lineHeight: 1.5,
                        marginBottom: 8,
                        color: isSel ? '#fff' : '#111',
                      }}
                    >
                      {p.title}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px 12px',
                        fontSize: 10,
                        color: isSel ? '#cfcfcf' : '#7a7a7a',
                      }}
                    >
                      {p.city && <span>{p.city}</span>}
                      {p.applicants?.[0] && <span>{p.applicants[0]}</span>}
                      {p.ipc_codes?.[0] && <span>{p.ipc_codes[0]}</span>}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        color: isSel ? '#7a7a7a' : '#cfcfcf',
                      }}
                    >
                      {p.application_no} · {p.filing_date}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: 70 }}>
                    <div
                      style={{
                        fontFamily: "'Libre Baskerville', serif",
                        fontSize: 28,
                        fontWeight: 700,
                        color: isSel ? '#fff' : '#111',
                        lineHeight: 1,
                      }}
                    >
                      {p.mega_score}
                    </div>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 8,
                        color: isSel ? '#7a7a7a' : '#7a7a7a',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        marginTop: 2,
                      }}
                    >
                      SCORE
                    </div>
                    <div style={{ fontSize: 10, color: isSel ? '#cfcfcf' : '#cfcfcf', marginTop: 6 }}>
                      {Math.round(p.num_claims || 0)}c · {p.num_pages}p
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
