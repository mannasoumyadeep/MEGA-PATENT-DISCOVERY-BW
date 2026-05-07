import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import FrontPage from './components/FrontPage';
import './styles/index.css';

function PlaceholderPage({ title }) {
  return (
    <main className="canvas">
      <div style={{ padding: '80px 0', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 38, fontWeight: 500, marginBottom: 12 }}>{title}</h1>
        <p style={{ color: '#6B7280', fontStyle: 'italic', fontFamily: 'Fraunces, serif' }}>
          This section is under editorial development.
        </p>
      </div>
    </main>
  );
}

export default function App() {
  const [active, setActive] = useState('front');

  return (
    <div className="app">
      <Sidebar active={active} onNavigate={setActive} balance={0} />
      {active === 'front' ? (
        <FrontPage />
      ) : (
        <PlaceholderPage title={
          {
            discover: 'Discover',
            search: 'Advanced Search',
            applicants: 'Applicants Directory',
            tech: 'Technology Domains',
            explorer: 'India Map Explorer',
            watchlists: 'Your Watchlists',
            reports: 'Intelligence Reports',
          }[active] || 'Page'
        } />
      )}
    </div>
  );
}
