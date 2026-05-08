import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { truncate, titleCase, cleanApplicants } from '../utils/format';

function FeaturedCard({ patent, onClick }) {
  const score = (patent.mega_score || 0).toFixed(1);
  const applicants = cleanApplicants(patent.applicants);
  const applicantName = applicants[0] || 'Undisclosed Applicant';
  const field = patent.field || patent.pub_type || 'General';
  const title = patent.title || 'Untitled Innovation';

  return (
    <button
      className="featured-card"
      onClick={() => onClick(patent)}
      aria-label={`View patent: ${title}`}
    >
      <div className="featured-card-top">
        <div className="featured-score">{score}</div>
        <div className="featured-tag">
          MEGA Patent
          <div style={{ marginTop: 2, color: 'var(--color-text-subtle)', fontSize: 8 }}>
            {truncate(field, 22)}
          </div>
        </div>
      </div>

      <div className="featured-card-title">
        {truncate(title, 90)}
      </div>

      <div className="featured-card-applicant">
        <span className="featured-applicant-dot" />
        <span title={applicantName}>{titleCase(truncate(applicantName, 38))}</span>
      </div>
    </button>
  );
}

export default function FeaturedCarousel({ patents = [], onPatentClick }) {
  const carouselRef = useRef(null);

  const scroll = (dir) => {
    const el = carouselRef.current;
    if (!el) return;
    const offset = dir === 'left' ? -el.clientWidth * 0.7 : el.clientWidth * 0.7;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  if (!patents.length) {
    return (
      <section className="featured">
        <div className="featured-header">
          <div className="featured-title-row">
            <span className="featured-title">Featured Innovations</span>
            <span className="featured-sub">Top MEGA Patents</span>
          </div>
        </div>
        <div className="empty-state">
          Featured patents will appear once journals are processed.
        </div>
      </section>
    );
  }

  // Sort by mega_score descending, take top 10
  const sorted = [...patents]
    .sort((a, b) => (b.mega_score || 0) - (a.mega_score || 0))
    .slice(0, 10);

  return (
    <section className="featured">
      <div className="featured-header">
        <div className="featured-title-row">
          <span className="featured-title">Featured Innovations</span>
          <span className="featured-sub">Top {sorted.length} MEGA Patents · click any to view details</span>
        </div>
      </div>

      <div className="carousel-wrap">
        <button
          className="carousel-arrow left"
          onClick={() => scroll('left')}
          aria-label="Scroll left"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>

        <div className="carousel" ref={carouselRef}>
          {sorted.map((p, i) => (
            <FeaturedCard
              key={p.id || p.application_no || i}
              patent={p}
              onClick={onPatentClick}
            />
          ))}
        </div>

        <button
          className="carousel-arrow right"
          onClick={() => scroll('right')}
          aria-label="Scroll right"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>
    </section>
  );
}
