export function MetricsBar({ stats, patents, activeJournal, loading }) {
  const metrics = [
    {
      value: stats?.overview?.total || patents.length,
      label: 'Total Patents',
      sub: activeJournal || 'all journals',
      testId: 'metric-total-patents',
    },
    {
      value: stats?.overview?.mega_patents || patents.filter((p) => p.mega_score >= 65).length,
      label: 'MEGA Patents',
      sub: 'score ≥ 65',
      testId: 'metric-mega-count',
    },
    {
      value: Math.round(stats?.overview?.avg_mega_score || 0),
      label: 'Avg Score',
      sub: '0-100 scale',
      testId: 'metric-avg-score',
    },
    {
      value: stats?.overview?.cities || new Set(patents.map((p) => p.city).filter(Boolean)).size,
      label: 'Cities',
      sub: 'innovation hubs',
      testId: 'metric-cities',
    },
    {
      value: Math.round(stats?.overview?.avg_claims || 0),
      label: 'Avg Claims',
      sub: 'per patent',
      testId: 'metric-claims',
    },
  ];

  return (
    <div
      data-testid="metrics-bar"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        borderBottom: '1px solid #dedede',
        flexShrink: 0,
      }}
    >
      {metrics.map((m, i) => (
        <div
          key={m.testId}
          data-testid={m.testId}
          style={{
            padding: '16px 20px',
            borderRight: i < 4 ? '1px solid #dedede' : 'none',
            background: '#ffffff',
          }}
        >
          <div
            style={{
              fontFamily: "'Libre Baskerville', serif",
              fontSize: 26,
              fontWeight: 700,
              color: '#111',
              lineHeight: 1,
            }}
          >
            {loading ? '…' : m.value}
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: '#5a5a5a',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginTop: 4,
            }}
          >
            {m.label}
          </div>
          <div style={{ fontSize: 10, color: '#7a7a7a', marginTop: 2 }}>{m.sub}</div>
        </div>
      ))}
    </div>
  );
}
