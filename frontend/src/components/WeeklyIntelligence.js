import React from 'react';
import { Calendar } from 'lucide-react';
import { fmtDate, fmt } from '../utils/format';

/**
 * Reads MEGA count from journal record with fallbacks for older field names.
 * Some journal records have `mega_patents_count: 0` (stale) AND `mega_count: 741` (correct).
 */
function getMegaCount(journal) {
  // Prefer new field; only fall back if it's literally undefined/null (not zero)
  if (journal.mega_count !== undefined && journal.mega_count !== null) {
    return journal.mega_count;
  }
  if (journal.mega_patents_count !== undefined && journal.mega_patents_count !== null) {
    return journal.mega_patents_count;
  }
  return 0;
}

function getTotalCount(journal) {
  if (journal.total_patents !== undefined && journal.total_patents !== null) {
    return journal.total_patents;
  }
  if (journal.patents_count !== undefined && journal.patents_count !== null) {
    return journal.patents_count;
  }
  return 0;
}

export default function WeeklyIntelligence({ journals = [], selectedJournal }) {
  const processed = journals.filter((j) => j.status === 'processed').slice(0, 5);
  const current = journals.find((j) => j.journal_no === selectedJournal) || processed[0];

  return (
    <div>
      <div className="intel-title">Weekly Intelligence</div>

      <div className="week-selector-label">Currently Showing</div>
      <div className="week-selector" style={{ cursor: 'default' }}>
        <Calendar size={13} strokeWidth={1.8} />
        <span>{current ? `Journal ${current.journal_no} · ${fmtDate(current.pub_date)}` : 'No journals processed'}</span>
      </div>

      <div className="recent-weeks">
        <div className="recent-weeks-header">
          <span>This Week</span>
          <span>MEGA Patents (≥65)</span>
        </div>

        {processed.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>No journals yet.</div>
        ) : (
          processed.map((j) => (
            <div key={j.journal_no} className="week-row">
              <div>
                <span className="week-label">Journal {j.journal_no}</span>
                <span className="week-date">({fmtDate(j.pub_date)})</span>
              </div>
              <span className="week-count">{fmt(getMegaCount(j))}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
