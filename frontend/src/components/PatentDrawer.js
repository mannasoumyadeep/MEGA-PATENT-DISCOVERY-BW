import React, { useEffect, useState, useMemo } from 'react';
import { X, ChevronLeft, Search } from 'lucide-react';
import { fmt, fmtDate, titleCase, cleanApplicants } from '../utils/format';
import {
  getPatentsByApplicant,
  getPatentsByField,
  getPatentsByState,
  getPatentsByJournal,
  searchPatents,
  getAllApplicantsIndex,
  getAllFieldsIndex,
  getAllMegaPatents,
} from '../api/client';

export default function PatentDrawer({ drawer, onClose }) {
  const [view, setView] = useState(null);
  const [listData, setListData] = useState(null);
  const [indexData, setIndexData] = useState(null);
  const [activePatent, setActivePatent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [navStack, setNavStack] = useState([]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (drawer) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, onClose]);

  useEffect(() => {
    if (!drawer) {
      setView(null); setListData(null); setIndexData(null);
      setActivePatent(null); setError(null); setFilterQuery('');
      setNavStack([]);
      return;
    }
    setNavStack([]);
    setFilterQuery('');
    setError(null);

    if (drawer.mode === 'placeholder') {
      setView('placeholder');
      return;
    }
    if (drawer.mode === 'patent') {
      setView('patent');
      setActivePatent(drawer.patent);
      return;
    }
    if (drawer.mode === 'all_mega') {
      setView('all_mega');
      setLoading(true);
      getAllMegaPatents(200)
        .then((patents) => setListData({
          title: 'All MEGA Patents', subtitle: 'Score ≥ 65', patents,
        }))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
      return;
    }
    if (drawer.mode === 'applicant_index') {
      setView('applicant_index');
      setLoading(true);
      getAllApplicantsIndex()
        .then((applicants) => setIndexData({
          title: 'All Applicants',
          subtitle: `${applicants.length} distinct entities · click any to view their patents`,
          rows: applicants,
        }))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
      return;
    }
    if (drawer.mode === 'field_index') {
      setView('field_index');
      setLoading(true);
      getAllFieldsIndex()
        .then((fields) => setIndexData({
          title: 'All Technology Fields',
          subtitle: `${fields.length} fields · click any to view its patents`,
          rows: fields,
        }))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
      return;
    }
    if (drawer.mode === 'list') {
      setView('list');
      setLoading(true);

      const fetchFn =
        drawer.filterType === 'applicant' ? getPatentsByApplicant :
        drawer.filterType === 'field'     ? getPatentsByField :
        drawer.filterType === 'state'     ? getPatentsByState :
        drawer.filterType === 'journal'   ? getPatentsByJournal :
        drawer.filterType === 'search'    ? searchPatents :
        null;

      if (!fetchFn) {
        setError('Unknown filter type');
        setLoading(false);
        return;
      }

      fetchFn(drawer.filterValue, 100)
        .then((patents) => setListData({
          title: drawer.filterTitle || drawer.filterValue,
          subtitle: drawer.filterSubtitle || '',
          patents,
        }))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [drawer]);

  if (!drawer) return null;

  const pushNav = (currentView) => setNavStack((s) => [...s, currentView]);

  const popNav = () => {
    setNavStack((s) => {
      const next = [...s];
      const prev = next.pop();
      if (prev === 'list') setView('list');
      else if (prev === 'applicant_index') setView('applicant_index');
      else if (prev === 'field_index') setView('field_index');
      else if (prev === 'all_mega') setView('all_mega');
      setActivePatent(null);
      return next;
    });
  };

  const handlePatentClick = (patent) => {
    pushNav(view);
    setActivePatent(patent);
    setView('patent');
  };

  const handleApplicantRowClick = (name) => {
    pushNav(view);
    setView('list');
    setLoading(true);
    setError(null);
    getPatentsByApplicant(name, 100)
      .then((patents) => setListData({
        title: name, subtitle: 'All patents from', patents,
      }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const handleFieldRowClick = (name) => {
    pushNav(view);
    setView('list');
    setLoading(true);
    setError(null);
    getPatentsByField(name, 100)
      .then((patents) => setListData({
        title: name, subtitle: 'Patents in', patents,
      }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const showBackButton = navStack.length > 0;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-header">
          {showBackButton ? (
            <button className="drawer-back" onClick={popNav}>
              <ChevronLeft size={14} strokeWidth={2} />
              <span>Back</span>
            </button>
          ) : <span />}
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="drawer-body">
          {loading && <div className="drawer-loading">Loading…</div>}
          {error && <div className="drawer-error">Error: {error}</div>}

          {!loading && !error && view === 'placeholder' && (
            <PlaceholderView title={drawer.title} customCopy={drawer.customCopy} />
          )}

          {!loading && !error && (view === 'list' || view === 'all_mega') && listData && (
            <ListView data={listData} onPatentClick={handlePatentClick} />
          )}

          {!loading && !error && view === 'applicant_index' && indexData && (
            <ApplicantIndexView
              data={indexData}
              filterQuery={filterQuery}
              setFilterQuery={setFilterQuery}
              onRowClick={handleApplicantRowClick}
            />
          )}

          {!loading && !error && view === 'field_index' && indexData && (
            <FieldIndexView
              data={indexData}
              filterQuery={filterQuery}
              setFilterQuery={setFilterQuery}
              onRowClick={handleFieldRowClick}
            />
          )}

          {!loading && !error && view === 'patent' && activePatent && (
            <PatentView patent={activePatent} />
          )}
        </div>
      </aside>
    </>
  );
}

function PlaceholderView({ title, customCopy }) {
  const copyParagraphs = customCopy || [
    'This section is currently under development.',
    'For now, all current intelligence is available on the Front Page — click any patent, applicant, technology, or state to explore.',
  ];

  return (
    <div className="drawer-placeholder">
      <div className="drawer-placeholder-eyebrow">Coming Soon</div>
      <h2 className="drawer-placeholder-title">{title}</h2>
      <div className="drawer-placeholder-divider" />
      <div className="drawer-placeholder-body">
        {copyParagraphs.map((para, i) => (
          <p key={i} className="drawer-placeholder-para">{para}</p>
        ))}
      </div>
    </div>
  );
}

function ListView({ data, onPatentClick }) {
  const { title, subtitle, patents } = data;
  return (
    <>
      <div className="drawer-list-header">
        <div className="drawer-list-eyebrow">{subtitle || 'Filtered Results'}</div>
        <div className="drawer-list-title">{title}</div>
        <div className="drawer-list-count">{patents.length} {patents.length === 1 ? 'patent' : 'patents'}</div>
      </div>
      {patents.length === 0 ? (
        <div className="drawer-empty">No patents found for this filter.</div>
      ) : (
        <div className="drawer-list">
          {patents.map((p) => (
            <button
              key={p.application_no || p.id}
              className="drawer-list-row"
              onClick={() => onPatentClick(p)}
            >
              <div className="drawer-list-row-top">
                <span className="drawer-list-score">{(p.mega_score || 0).toFixed(0)}</span>
                <span className="drawer-list-field">{p.field || 'General'}</span>
              </div>
              <div className="drawer-list-row-title">{p.title || 'Untitled'}</div>
              <div className="drawer-list-row-meta">
                <span>{titleCase(cleanApplicants(p.applicants)[0] || 'Undisclosed')}</span>
                {p.publication_date && <span>· {fmtDate(p.publication_date)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function ApplicantIndexView({ data, filterQuery, setFilterQuery, onRowClick }) {
  const { title, subtitle, rows } = data;
  const filtered = useMemo(() => {
    if (!filterQuery || filterQuery.length < 2) return rows;
    const q = filterQuery.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, filterQuery]);

  return (
    <>
      <div className="drawer-list-header">
        <div className="drawer-list-eyebrow">Index</div>
        <div className="drawer-list-title">{title}</div>
        <div className="drawer-list-count">{subtitle}</div>
      </div>
      <div className="drawer-filter">
        <Search size={13} strokeWidth={1.8} />
        <input
          className="drawer-filter-input"
          placeholder="Filter applicants..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <div className="drawer-empty">No applicants match "{filterQuery}".</div>
      ) : (
        <div className="drawer-index-list">
          {filtered.map((r) => (
            <button key={r.name} className="drawer-index-row" onClick={() => onRowClick(r.name)}>
              <span className="drawer-index-rank">{r.rank}</span>
              <span className="drawer-index-name">{titleCase(r.name)}</span>
              <span className="drawer-index-count">{fmt(r.count)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function FieldIndexView({ data, filterQuery, setFilterQuery, onRowClick }) {
  const { title, subtitle, rows } = data;
  const filtered = useMemo(() => {
    if (!filterQuery || filterQuery.length < 2) return rows;
    const q = filterQuery.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, filterQuery]);

  return (
    <>
      <div className="drawer-list-header">
        <div className="drawer-list-eyebrow">Index</div>
        <div className="drawer-list-title">{title}</div>
        <div className="drawer-list-count">{subtitle}</div>
      </div>
      <div className="drawer-filter">
        <Search size={13} strokeWidth={1.8} />
        <input
          className="drawer-filter-input"
          placeholder="Filter fields..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <div className="drawer-empty">No fields match "{filterQuery}".</div>
      ) : (
        <div className="drawer-index-list">
          {filtered.map((r) => (
            <button key={r.name} className="drawer-index-row" onClick={() => onRowClick(r.name)}>
              <span className="drawer-index-rank">{r.rank}</span>
              <span className="drawer-index-name">{titleCase(r.name)}</span>
              <span className="drawer-index-count">{fmt(r.count)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function PatentView({ patent }) {
  const score = (patent.mega_score || 0).toFixed(1);
  const tier =
    patent.mega_score >= 90 ? 'ULTRA' :
    patent.mega_score >= 65 ? 'MEGA' : 'STANDARD';

  const applicants = cleanApplicants(patent.applicants);
  const inventors = patent.inventors || [];
  const ipcCodes = patent.ipc_codes || [];

  return (
    <>
      <div className="patent-detail-header">
        <div className="patent-detail-tags">
          <span className="patent-detail-tag">{patent.field || 'General'}</span>
          <span className={`patent-detail-tier tier-${tier.toLowerCase()}`}>{tier}</span>
        </div>
        <div className="patent-detail-score">
          <span className="patent-score-num">{score}</span>
          <span className="patent-score-label">MEGA Score</span>
        </div>
      </div>

      <h2 className="patent-detail-title">{patent.title || 'Untitled Innovation'}</h2>

      <div className="patent-detail-meta">
        {patent.application_no && (
          <div className="patent-meta-row">
            <span className="patent-meta-label">Application No.</span>
            <span className="patent-meta-value">{patent.application_no}</span>
          </div>
        )}
        {patent.filing_date && (
          <div className="patent-meta-row">
            <span className="patent-meta-label">Filing Date</span>
            <span className="patent-meta-value">{fmtDate(patent.filing_date)}</span>
          </div>
        )}
        {patent.publication_date && (
          <div className="patent-meta-row">
            <span className="patent-meta-label">Published</span>
            <span className="patent-meta-value">{fmtDate(patent.publication_date)}</span>
          </div>
        )}
        {patent.journal_no && (
          <div className="patent-meta-row">
            <span className="patent-meta-label">Journal</span>
            <span className="patent-meta-value">{patent.journal_no}</span>
          </div>
        )}
        {patent.pub_type && (
          <div className="patent-meta-row">
            <span className="patent-meta-label">Type</span>
            <span className="patent-meta-value">{patent.pub_type}</span>
          </div>
        )}
        {(patent.num_pages || patent.num_claims) && (
          <div className="patent-meta-row">
            <span className="patent-meta-label">Document</span>
            <span className="patent-meta-value">
              {patent.num_pages || 0} pages · {patent.num_claims || 0} claims
            </span>
          </div>
        )}
        {(patent.city || patent.state) && (
          <div className="patent-meta-row">
            <span className="patent-meta-label">Location</span>
            <span className="patent-meta-value">
              {[patent.city, patent.state].filter(Boolean).join(', ')}
            </span>
          </div>
        )}
      </div>

      {applicants.length > 0 && (
        <div className="patent-detail-section">
          <div className="patent-section-label">Applicants</div>
          <div className="patent-section-content">
            {applicants.map((a, i) => (
              <div key={i} className="patent-list-item">{titleCase(a)}</div>
            ))}
          </div>
        </div>
      )}

      {inventors.length > 0 && (
        <div className="patent-detail-section">
          <div className="patent-section-label">Inventors</div>
          <div className="patent-section-content">
            {inventors.map((inv, i) => (
              <div key={i} className="patent-list-item">{titleCase(inv)}</div>
            ))}
          </div>
        </div>
      )}

      {ipcCodes.length > 0 && (
        <div className="patent-detail-section">
          <div className="patent-section-label">IPC Classification</div>
          <div className="patent-section-content patent-ipc-list">
            {ipcCodes.map((code, i) => (
              <span key={i} className="patent-ipc-chip">{code}</span>
            ))}
          </div>
        </div>
      )}

      {patent.abstract && (
        <div className="patent-detail-section">
          <div className="patent-section-label">Abstract</div>
          <div className="patent-abstract">{patent.abstract}</div>
        </div>
      )}

      {patent.address && (
        <div className="patent-detail-section">
          <div className="patent-section-label">Applicant Address</div>
          <div className="patent-address">{patent.address}</div>
        </div>
      )}
    </>
  );
}
