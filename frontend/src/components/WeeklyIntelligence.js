import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { fmtDate, fmt } from '../utils/format';

export default function WeeklyIntelligence({ journals = [], selectedJournal, onSelectJournal, onViewAll }) {
  const processed = journals.filter((j) => j.status === 'processed').slice(0, 5);
  const current = journals.find((j) => j.journal_no === selectedJournal) || processed[0];

  return (
    <div>
      <div className="intel-title">Weekly Intelligence</div>

      <div className="week-selector-label">Select Week (Recent to Older)</div>
      <button className="week-selector">
        <Calendar size={13} strokeWidth={1.8} />
        <span>{current ? `Journal ${current.journal_no} · ${fmtDate(current.pub_date)}` : 'No journals processed'}</span>
        <ChevronDown size={13} strokeWidth={1.8} style={{ marginLeft: 'auto' }} />
      </button>

      <div className="recent-weeks">
        <div className="recent-weeks-header">
          <span>Recent Weeks</span>
          <span>MEGA Patents (≥65)</span>
        </div>

        {processed.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>No journals yet.</div>
        ) : (
          processed.map((j) => (
            <div
              key={j.journal_no}
              className="week-row"
              onClick={() => onSelectJournal?.(j.journal_no)}
            >
              <div>
                <span className="week-label">Journal {j.journal_no}</span>
                <span className="week-date">({fmtDate(j.pub_date)})</span>
              </div>
              <span className="week-count">{fmt(j.mega_count || 0)}</span>
            </div>
          ))
        )}
      </div>

      <span className="view-all-link" onClick={onViewAll}>View All Weeks →</span>
    </div>
  );
}
