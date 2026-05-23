import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import FrontPage from './components/FrontPage';
import PatentDrawer from './components/PatentDrawer';
import { api } from './api/client';

// v3.7: Single consolidated stylesheet only
import './styles/index.css';

const DEFAULT_SETTINGS = {
  reimbursement_amount: 849,
  reimbursement_currency: 'INR',
  reimbursement_label: 'Community Support',
};

const INNOVATION_NETWORK_COPY = [
  'This section is currently under development.',
  'For now, all current intelligence is available on the Front Page — click any patent, applicant, technology, or state to explore.',
  'We\'re building dedicated tooling to help innovators, researchers, industry professionals, and technology seekers connect through patent and innovation intelligence.',
  'This initiative is being developed independently and transparently, with continuous improvements evolving openly over time.',
  'Your feedback and support directly help shape and accelerate the development of this platform.',
];

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [drawer, setDrawer] = useState(null);

  // Fetch settings on mount AND on window focus (so amount refreshes when
  // user returns from Razorpay checkout)
  useEffect(() => {
    const fetchSettings = () => {
      api.settings()
        .then((s) => setSettings(s || DEFAULT_SETTINGS))
        .catch(() => setSettings(DEFAULT_SETTINGS));
    };
    fetchSettings();
    window.addEventListener('focus', fetchSettings);
    return () => window.removeEventListener('focus', fetchSettings);
  }, []);

  const handleSidebarNav = (label) => {
    if (label === 'Innovation Network') {
      setDrawer({
        mode: 'placeholder',
        title: 'Innovation Network',
        customCopy: INNOVATION_NETWORK_COPY,
      });
    } else {
      setDrawer({ mode: 'placeholder', title: label });
    }
  };

  return (
    <div className="app">
      <Sidebar settings={settings} onNavClick={handleSidebarNav} />
      <FrontPage drawer={drawer} setDrawer={setDrawer} />
      <PatentDrawer drawer={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
