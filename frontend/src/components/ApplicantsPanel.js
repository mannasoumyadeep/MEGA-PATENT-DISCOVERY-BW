import React from 'react';
import { Cpu, Battery, Zap, Microscope, Leaf, Atom, Wifi, Pill } from 'lucide-react';
import { fmt, titleCase, truncate } from '../utils/format';

const TECH_ICON_MAP = [
  { match: /electric|circuit|comm|signal/i, icon: Wifi },
  { match: /chem|organic|pharma|drug/i, icon: Pill },
  { match: /medical|veter|bio|surg/i, icon: Microscope },
  { match: /comput|algo|ai|machine|softw/i, icon: Cpu },
  { match: /energy|solar|battery|hydro/i, icon: Battery },
  { match: /agri|food/i, icon: Leaf },
  { match: /physics|optic|laser/i, icon: Zap },
];

function pickIcon(name) {
  const found = TECH_ICON_MAP.find((t) => t.match.test(name || ''));
  return found ? found.icon : Atom;
}

export default function ApplicantsPanel({
  topApplicants = [],
  emergingTech = [],
  selectedJournal,
  onApplicantClick,
  onTechClick,
}) {
  return (
    <div>
      {/* TOP APPLICANTS */}
      <div className="applicants-header">
        <div className="applicants-title-group">
          <span className="applicants-title">Top Applicants</span>
          {selectedJournal && (
            <span className="applicants-week">({selectedJournal})</span>
          )}
        </div>
      </div>

      <div>
        {topApplicants.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>No applicant data.</div>
        ) : (
          topApplicants.map((a) => (
            <button
              key={a.name}
              className="applicant-row clickable"
              onClick={() => onApplicantClick && onApplicantClick(a.name)}
              aria-label={`View patents from ${a.name}`}
            >
              <span className="applicant-rank">{a.rank}</span>
              <span className="applicant-name" title={a.name}>
                {titleCase(truncate(a.name, 32))}
              </span>
              <span className="applicant-count">{fmt(a.count)}</span>
            </button>
          ))
        )}
      </div>

      {/* EMERGING TECHNOLOGIES */}
      <div className="tech-section">
        <div className="applicants-title" style={{ marginBottom: 12 }}>Emerging Technologies</div>
        {emergingTech.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>No technology breakdown.</div>
        ) : (
          emergingTech.map((t) => {
            const Icon = pickIcon(t.name);
            return (
              <button
                key={t.name}
                className="tech-row clickable"
                onClick={() => onTechClick && onTechClick(t.name)}
                aria-label={`View patents in ${t.name}`}
              >
                <div className="tech-name">
                  <Icon className="tech-icon" size={13} strokeWidth={1.8} />
                  <span>{titleCase(truncate(t.name, 24))}</span>
                </div>
                <span className="tech-growth">{fmt(t.count)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
