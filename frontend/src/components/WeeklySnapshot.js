import React from 'react';
import { Info } from 'lucide-react';
import { fmt, fmtCompact, fmtDate } from '../utils/format';

export default function WeeklySnapshot({ stats, journals = [], lastUpdated }) {
  const total = stats?.total_patents ?? 0;
  const mega = stats?.mega_patents ?? 0;
  const pending = Math.max(total - mega, 0);
  const cities = stats?.cities ?? 0;
  const avgClaims = stats?.avg_claims ?? 0;

  // Distinct fields count from by_field
  const fieldCount = (stats?.by_field || []).length;

  // Latest journal label
  const latest = journals.find((j) => j.status === 'processed') || journals[0];
  const titleLabel = latest
    ? `Weekly Snapshot · Journal ${latest.journal_no} · ${fmtDate(latest.pub_date)}`
    : 'Weekly Snapshot';

  const updatedLabel = lastUpdated
    ? `Data updated ${lastUpdated}`
    : 'Live data from MongoDB Atlas';

  const metrics = [
    { label: 'MEGA Patents (≥ 65)', value: fmt(mega), gold: true, caption: latest ? `+${fmt(latest.mega_count || 0)} this period` : '' },
    { label: 'Pending Evaluation', value: fmt(pending), caption: pending > 0 ? `${Math.round((pending / total) * 100)}% of total` : '' },
    { label: 'Total Patents', value: fmtCompact(total), caption: 'Across India' },
    { label: 'Applicants', value: fmt(stats?.applicants_count ?? '—'), caption: 'Distinct entities' },
    { label: 'Tech Domains', value: fieldCount || '—', caption: (stats?.by_field || []).slice(0, 4).map((f) => f.field?.split(' ')[0]).filter(Boolean).join(' · ') || 'Diverse' },
    { label: 'Cities Covered', value: fmt(cities), caption: 'Innovation hubs' },
  ];

  return (
    <>
      <div className="snapshot-header">
        <div className="snapshot-title">
          {titleLabel}
          <Info size={11} strokeWidth={1.8} style={{ color: 'var(--color-text-subtle)' }} />
        </div>
        <div className="snapshot-update">{updatedLabel}</div>
      </div>

      <div className="metrics-row">
        {metrics.map((m, i) => (
          <div key={i} className="metric">
            <div className="metric-label">{m.label}</div>
            <div className={`metric-value ${m.gold ? 'gold' : ''}`}>{m.value}</div>
            {m.caption && <div className="metric-caption">{m.caption}</div>}
          </div>
        ))}
      </div>
    </>
  );
}
