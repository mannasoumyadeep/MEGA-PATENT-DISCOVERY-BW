import React, { useEffect, useRef, useState } from 'react';
import { Home, Network, Menu, X, Heart } from 'lucide-react';

function HiddenRazorpayForm({ formRef }) {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current || !formRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/payment-button.js';
    script.async = true;
    script.setAttribute('data-payment_button_id', 'pl_SmUidG4BFT6t10');
    formRef.current.appendChild(script);
    mountedRef.current = true;
  }, [formRef]);

  return (
    <form
      ref={formRef}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        opacity: 0,
        pointerEvents: 'none',
        height: 0,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    />
  );
}

export default function Sidebar({ settings = null, onNavClick }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const razorpayFormRef = useRef(null);

  const handleSupport = () => {
    setPaymentError(null);
    const btn = razorpayFormRef.current?.querySelector('button');
    if (btn) {
      // Razorpay button injected normally — click it
      btn.click();
    } else {
      // Razorpay script blocked (ad-blocker, network) — graceful fallback
      setPaymentError(
        'Payment system unavailable. Please disable ad-blocker for this site or try another browser.'
      );
    }
  };

  const handleNavClick = (label) => {
    setMobileOpen(false);
    onNavClick && onNavClick(label);
  };

  const amount = settings?.reimbursement_amount ?? 849;
  const currency = settings?.reimbursement_currency ?? 'INR';
  const symbol = currency === 'INR' ? '₹' : currency + ' ';

  return (
    <>
      <button
        className="mobile-menu-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X size={18} strokeWidth={2} /> : <Menu size={18} strokeWidth={2} />}
      </button>

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
            <span className="nav-label">Front Page</span>
          </div>

          <button
            className="nav-item nav-item-button"
            onClick={() => handleNavClick('Innovation Network')}
          >
            <Network className="nav-icon" size={14} strokeWidth={1.8} />
            <span className="nav-label">Innovation Network</span>
          </button>
        </nav>

        <div className="payment-widget community-support">
          <div className="payment-widget-label">
            <Heart size={10} strokeWidth={2.2} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Community Support
          </div>
          <div className="payment-widget-amount">
            {symbol} {Number(amount).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </div>
          <div className="payment-widget-caption">
            Independent patent intelligence, funded by community goodwill.
          </div>

          {/* Always-enabled button. Fallback if Razorpay is ad-blocked. */}
          <button
            className="payment-widget-button"
            onClick={handleSupport}
          >
            Support This Project
          </button>

          {paymentError && (
            <p className="payment-error-note">{paymentError}</p>
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

      <HiddenRazorpayForm formRef={razorpayFormRef} />
    </>
  );
}
