import React from 'react';
import { fmt, fmtDate } from '../utils/format';

export default function Hero({ stats, latestJournal }) {
  const totalPatents = stats?.total_patents ?? 0;
  const megaPatents = stats?.mega_patents ?? 0;

  const briefHeadline = totalPatents > 0
    ? `${fmt(megaPatents)} new MEGA-tier patents identified across India this period`
    : 'Awaiting first journal ingestion';

  const briefDate = latestJournal?.pub_date
    ? fmtDate(latestJournal.pub_date) + ` · Journal ${latestJournal.journal_no}`
    : 'No journal processed yet';

  return (
    <section className="hero">
      <h1 className="hero-headline">
        Intelligence on Innovation.<br />
        Curated for What Matters.
      </h1>

      <div className="hero-deck">
        <p className="hero-deck-text">
          MEGA Patent Discovery surfaces India's most impactful patent innovations —
          evaluated and curated with editorial rigor. Built on the IP India Patent
          Journal, scored on documentation depth, claim breadth, and applicant
          credibility.
        </p>
      </div>

      <div className="hero-brief">
        <div className="hero-brief-label">This Week's Brief</div>
        <div className="hero-brief-date">{briefDate}</div>
        <div className="hero-brief-headline">{briefHeadline}</div>
      </div>
    </section>
  );
}
