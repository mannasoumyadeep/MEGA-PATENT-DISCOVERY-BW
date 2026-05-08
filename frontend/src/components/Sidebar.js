import React, { useEffect, useRef, useState } from 'react';
import { Home, Compass, Search as SearchIcon, Users, Cpu, Map, Bookmark, FileText, Menu, X } from 'lucide-react';

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

const NAV_ITEMS = [
  { id: 'discover',     label: 'Discover',     icon: Compass,    placeholder: true },
  { id: 'search',       label: 'Search',       icon: SearchIcon, placeholder: true },
  { id: 'applicants',   label: 'Applicants',   icon: Users,      placeholder: true },
  { id: 'technologies', label: 'Technologies', icon: Cpu,        placeholder: true },
  { id: 'explorer',     label: 'Explorer',     icon: Map,        placeholder: true },
  { id: 'watchlists',   label: 'Watchlists',   icon: Bookmark,   placeholder: true },
  { id: 'reports',      label: 'Reports',      icon: FileText,   placeholder: true },
];

export default function Sidebar({ settings = null, onNavClick }) {
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar when clicking a nav item
  const handleNavClick = (item) => {
    setMobileOpen(false);
    onNavClick && onNavClick(item.label);
  };

  const amount = settings?.reimbursement_amount ?? 849;
  const currency = settings?.reimbursement_currency ?? 'INR';
  const label = settings?.reimbursement_label ?? 'Reimbursement Collected';
  const symbol = currency === 'INR' ? '₹' : currency + ' ';

  return (
    <>
      {/* Mobile hamburger toggle (only visible on small screens via CSS) */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X size={18} strokeWidth={2} /> : <Menu size={18} strokeWidth={2} />}
      </button>

      {/* Backdrop for mobile sidebar overlay */}
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">MEGA</div>
          <div className="brand-sub">Patent Discovery</div>
          <div className="brand-divider" />
          <div className="brand-tagline">Editorial Intelligence Terminal</div>
        </div>

        <nav className="nav">
          <div className="nav-item active" onClick={() => setMobileOpen(false)}>
            <Home className="nav-icon" size={14} strokeWidth={1.8} />
            <span>Front Page</span>
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="nav-item nav-item-button"
                onClick={() => handleNavClick(item)}
              >
                <Icon className="nav-icon" size={14} strokeWidth={1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="payment-widget">
          <div className="payment-widget-label">{label}</div>
          <div className="payment-widget-amount">
            {symbol} {Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="payment-widget-caption">
            Available for future platform enhancements
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

        <div className="sidebar-footer">
          <div className="sidebar-footer-label">Source</div>
          <div className="sidebar-footer-text">
            IP India Patent Journal<br />
            Updated weekly
          </div>
        </div>
      </aside>
    </>
  );
}
