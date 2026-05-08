import React from 'react';
import { Info } from 'lucide-react';
import { fmt, fmtCompact, fmtDate } from '../utils/format';

export default function WeeklySnapshot({
  stats,
  journals = [],
  totalApplicants,
  lastUpdated,
  onMegaClick,
  onApplicantsClick,
  onFieldsClick,
}) {
  const total = stats?.total_patents ?? 0;
  const mega = stats?.mega_patents ?? 0;
  const standard = Math.max(total - mega, 0);
  const cities = stats?.cities ?? 0;
  const fields = (stats?.by_field || []).filter(
    (f) => f.field && !/^(unknown|other)$/i.test(f.field)
  );
  const fieldCount = fields.length;
  const topFieldNames = fields.slice(0, 3).map((f) => f.field).join(' · ') || 'Diverse';

  const latest = journals.find((j) => j.status === 'processed') || journals[0];
  const titleLabel = latest
    ? `Weekly Snapshot · Journal ${latest.journal_no} · ${fmtDate(latest.pub_date)}`
    : 'Weekly Snapshot';

  const updatedLabel = lastUpdated ? `Updated ${lastUpdated}` : 'Live data';
  const leadApplicant = stats?.lead_applicant_name || null;

  // Each metric: optional onClick makes it interactive
  const metrics = [
    {
      label: 'MEGA Patents (≥ 65)',
      value: fmt(mega),
      gold: true,
      caption: 'Click to browse all',
      onClick: onMegaClick,
    },
    {
      label: 'Standard Patents',
      value: fmt(standard),
      caption: 'Below MEGA threshold',
    },
    {
      label: 'Total Filings',
      value: fmtCompact(total),
      caption: 'All journal entries',
    },
    {
      label: 'Distinct Applicants',
      value: fmt(totalApplicants ?? '—'),
      caption: leadApplicant ? `Top: ${titleCaseShort(leadApplicant)}` : 'Click to browse all',
      onClick: onApplicantsClick,
    },
    {
      label: 'Tech Fields',
      value: fieldCount || '—',
      caption: 'Click to browse all',
      onClick: onFieldsClick,
    },
    {
      label: 'Cities Covered',
      value: fmt(cities),
      caption: 'Innovation hubs in India',
    },
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
        {metrics.map((m, i) => {
          const isClickable = !!m.onClick;
          const Wrapper = isClickable ? 'button' : 'div';
          return (
            <Wrapper
              key={i}
              className={`metric ${isClickable ? 'metric-clickable' : ''}`}
              onClick={m.onClick}
              {...(isClickable ? { type: 'button' } : {})}
            >
              <div className="metric-label">{m.label}</div>
              <div className={`metric-value ${m.gold ? 'gold' : ''}`}>{m.value}</div>
              {m.caption && <div className="metric-caption">{m.caption}</div>}
            </Wrapper>
          );
        })}
      </div>
    </>
  );
}

function titleCaseShort(s) {
  if (!s) return '';
  const t = s.length > 26 ? s.slice(0, 26) + '…' : s;
  return t.split(' ').map((w) =>
    w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}
