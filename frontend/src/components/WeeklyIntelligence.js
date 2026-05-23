import React from 'react';
import { Calendar } from 'lucide-react';
import { fmtDate, fmt } from '../utils/format';

function generateRecentJournalWeeks(count = 8) {
  const weeks = [];
  let date = new Date();
  date.setHours(12, 0, 0, 0);

  while (date.getDay() !== 5) {
    date.setDate(date.getDate() - 1);
  }

  for (let i = 0; i < count; i++) {
    const weekNum = getISOWeek(date);
    const year = date.getFullYear();
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    weeks.push({
      journal_no: `${weekNum}/${year}`,
      pub_date: `${dd}/${mm}/${year}`,
      sort_key: date.getTime(),
    });
    date.setDate(date.getDate() - 7);
  }

  return weeks;
}

function getISOWeek(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(
    ((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7
  );
}

function getMegaCount(journal) {
  // Prefer new field. Fall back to old field. Both should be in sync after fix_journal_counts.py
  if (journal.mega_count !== undefined && journal.mega_count !== null) {
    return journal.mega_count;
  }
  if (journal.mega_patents_count !== undefined && journal.mega_patents_count !== null) {
    return journal.mega_patents_count;
  }
  return 0;
}

export default function WeeklyIntelligence({
  journals = [],
  selectedJournal,
  onJournalClick,
}) {
  const inDbByNo = React.useMemo(() => {
    const m = new Map();
    journals.forEach((j) => {
      if (j.status === 'processed') {
        m.set(j.journal_no, j);
      }
    });
    return m;
  }, [journals]);

  const recentWeeks = React.useMemo(() => generateRecentJournalWeeks(8), []);

  const current = inDbByNo.get(selectedJournal) ||
    [...inDbByNo.values()].sort((a, b) =>
      (b.pub_date || '').localeCompare(a.pub_date || '')
    )[0];

  const archivedCount = recentWeeks.filter((w) => !inDbByNo.has(w.journal_no)).length;

  return (
    <div>
      <div className="intel-title">Weekly Intelligence</div>

      <div className="week-selector-label">Currently Showing</div>
      <div className="week-selector" style={{ cursor: 'default' }}>
        <Calendar size={13} strokeWidth={1.8} />
        <span>
          {current
            ? `Journal ${current.journal_no} · ${fmtDate(current.pub_date)}`
            : 'No journals processed'}
        </span>
      </div>

      <div className="recent-weeks">
        <div className="recent-weeks-header">
          <span>Recent Weeks</span>
          <span>MEGA Patents (≥65)</span>
        </div>

        {recentWeeks.map((week) => {
          const dbRecord = inDbByNo.get(week.journal_no);
          const isLive = !!dbRecord;
          const isCurrent = isLive && current && week.journal_no === current.journal_no;
          const megaCount = isLive ? getMegaCount(dbRecord) : null;
          // v3.6: only show the number if it's actually meaningful (> 0)
          const showCount = isLive && megaCount !== null && megaCount > 0;

          return (
            <button
              key={week.journal_no}
              className={`week-row-button ${isCurrent ? 'is-current' : ''} ${isLive ? 'is-live' : 'is-archived'}`}
              onClick={() => {
                if (isLive && onJournalClick) {
                  onJournalClick(dbRecord);
                }
              }}
              disabled={!isLive}
              title={isLive
                ? `View patents from Journal ${week.journal_no}`
                : 'This journal is currently archived'}
            >
              <div className="week-row-left">
                <span className="week-label">Journal {week.journal_no}</span>
                <span className="week-date">({fmtDate(week.pub_date)})</span>
                {!isLive && <span className="week-archived-tag">Archived</span>}
              </div>
              {showCount && (
                <span className="week-count">{fmt(megaCount)}</span>
              )}
            </button>
          );
        })}

        {archivedCount > 0 && (
          <p className="recent-weeks-footnote">
            Earlier weeks are currently archived. Storage limits restrict how many
            weeks remain live. Reader support enables broader coverage.
          </p>
        )}
      </div>
    </div>
  );
}
