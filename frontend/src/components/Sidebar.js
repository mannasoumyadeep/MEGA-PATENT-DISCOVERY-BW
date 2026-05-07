import React, { useEffect, useRef, useState } from 'react';
import {
  Home, Compass, Search, Users, Cpu, Map as MapIcon,
  Star, FileText, Settings, LogOut, ChevronDown
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'front', label: 'Front Page', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'applicants', label: 'Applicants', icon: Users },
  { id: 'tech', label: 'Technologies', icon: Cpu },
  { id: 'explorer', label: 'Explorer', icon: MapIcon },
  { id: 'watchlists', label: 'Watchlists', icon: Star },
  { id: 'reports', label: 'Reports', icon: FileText },
];

/**
 * Razorpay Payment Button
 * Mounts the official Razorpay checkout button inside a form.
 * Re-mounting requires re-injecting the script tag.
 */
function RazorpayButton() {
  const formRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current || !formRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/payment-button.js';
    script.async = true;
    script.setAttribute('data-payment_button_id', 'pl_SmUidG4BFT6t10');
    formRef.current.appendChild(script);
    mountedRef.current = true;
  }, []);

  return <form ref={formRef} style={{ display: 'inline-block', width: '100%' }} />;
}

export default function Sidebar({ active = 'front', onNavigate, balance = 0 }) {
  const [showRazorpay, setShowRazorpay] = useState(false);

  return (
    <aside className="sidebar">
      {/* BRAND */}
      <div className="brand">
        <div className="brand-mark">MEGA</div>
        <div className="brand-sub">Patent Discovery</div>
        <div className="brand-divider" />
        <div className="brand-tagline">Editorial Intelligence Terminal</div>
      </div>

      {/* NAVIGATION */}
      <nav className="nav">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <div
            key={id}
            className={`nav-item ${active === id ? 'active' : ''}`}
            onClick={() => onNavigate?.(id)}
          >
            <Icon className="nav-icon" size={14} strokeWidth={1.8} />
            <span>{label}</span>
          </div>
        ))}
      </nav>

      {/* PAYMENT / REIMBURSEMENT WIDGET */}
      <div className="payment-widget">
        <div className="payment-widget-label">
          Reimbursement Balance
        </div>
        <div className="payment-widget-amount">
          ₹ {balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="payment-widget-caption">
          Available for patent data access &amp; downloads
        </div>

        {!showRazorpay ? (
          <button
            className="payment-widget-button"
            onClick={() => setShowRazorpay(true)}
          >
            Add Reimbursement
          </button>
        ) : (
          <div style={{ marginTop: 12 }}>
            <RazorpayButton />
          </div>
        )}
      </div>

      {/* SESSION FOOTER */}
      <div className="session-area">
        <div className="session-label">Session</div>
        <div className="session-user">
          <span>Analyst</span>
          <ChevronDown size={12} strokeWidth={1.8} />
        </div>
        <div className="session-actions">
          <div className="session-link">
            <Settings size={12} strokeWidth={1.8} />
            <span>Settings</span>
          </div>
          <div className="session-link">
            <LogOut size={12} strokeWidth={1.8} />
            <span>Sign Out</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
