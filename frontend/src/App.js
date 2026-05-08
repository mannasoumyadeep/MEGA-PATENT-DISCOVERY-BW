import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import FrontPage from './components/FrontPage';
import PatentDrawer from './components/PatentDrawer';
import { api } from './api/client';
import './styles/index.css';

const DEFAULT_SETTINGS = {
  reimbursement_amount: 849,
  reimbursement_currency: 'INR',
  reimbursement_label: 'Reimbursement Collected',
};

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [drawer, setDrawer] = useState(null);

  useEffect(() => {
    api.settings()
      .then((s) => setSettings(s || DEFAULT_SETTINGS))
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, []);

  // Sidebar nav click → open placeholder drawer
  const handleSidebarNav = (label) => {
    setDrawer({ mode: 'placeholder', title: label });
  };

  return (
    <div className="app">
      <Sidebar settings={settings} onNavClick={handleSidebarNav} />
      <FrontPage drawer={drawer} setDrawer={setDrawer} />
      <PatentDrawer drawer={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
