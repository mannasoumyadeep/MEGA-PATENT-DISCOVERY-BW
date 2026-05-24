import React, { useEffect, useState } from 'react';
import { Home, Network, Menu, X, Heart } from 'lucide-react';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const PRESET_AMOUNTS = [100, 500, 1000];
const DEFAULT_TARGET = 10000;

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Razorpay script failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay script failed to load'));
    document.head.appendChild(script);
  });
}

function formatRupees(n) {
  return Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatRupeesShort(n) {
  return Number(n || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  });
}

export default function Sidebar({ settings = null, onNavClick, onRefresh }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Pre-warm Razorpay script
  useEffect(() => {
    loadRazorpayScript().catch(() => {/* will retry on click */});
  }, []);

  const handleSupportClick = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setCustomAmount('');
    setShowAmountModal(true);
  };

  const handleContribute = async (amountRupees) => {
    if (!amountRupees || Number(amountRupees) < 1) {
      setErrorMessage('Please enter a valid amount (minimum ₹1)');
      return;
    }
    if (Number(amountRupees) > 500000) {
      setErrorMessage('Maximum contribution is ₹5,00,000');
      return;
    }

    setProcessing(true);
    setErrorMessage(null);

    try {
      await loadRazorpayScript();

      const apiBase = process.env.REACT_APP_BACKEND_URL || '';
      const orderResp = await fetch(`${apiBase}/api/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(Number(amountRupees) * 100),
          currency: 'INR',
        }),
      });

      if (!orderResp.ok) {
        const errText = await orderResp.text();
        throw new Error(`Order creation failed (${orderResp.status}): ${errText.slice(0, 200)}`);
      }
      const order = await orderResp.json();

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'MEGA Patent Discovery',
        description: 'Community Support Contribution',
        order_id: order.order_id,
        theme: { color: '#B8860B' },
        handler: function (response) {
          // Payment captured. Webhook fires on the backend.
          setShowAmountModal(false);
          setProcessing(false);
          setSuccessMessage(
            `Thank you! Your ₹${formatRupeesShort(amountRupees)} contribution was received.`
          );

          // Refresh strategy:
          //   - If parent provided onRefresh (App.js wired up): smart refetch (no reload, preserves scroll)
          //   - Otherwise: full page reload after delay (works without App.js changes)
          if (typeof onRefresh === 'function') {
            setTimeout(() => {
              onRefresh();
              // Retry once at 5.5s in case webhook is slow
              setTimeout(() => onRefresh(), 3000);
            }, 2500);
          } else {
            setTimeout(() => {
              window.location.reload();
            }, 3000);
          }

          // Clear success message eventually
          setTimeout(() => setSuccessMessage(null), 10000);
        },
        modal: {
          ondismiss: function () {
            setProcessing(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setErrorMessage(`Payment failed: ${response.error?.description || 'unknown error'}`);
        setProcessing(false);
      });
      rzp.open();
    } catch (error) {
      setErrorMessage(error.message || 'Something went wrong. Please try again.');
      setProcessing(false);
    }
  };

  const handleNavClick = (label) => {
    setMobileOpen(false);
    onNavClick && onNavClick(label);
  };

  const amount = Number(settings?.reimbursement_amount ?? 849);
  const target = Number(settings?.target_amount ?? DEFAULT_TARGET);
  const currency = settings?.reimbursement_currency ?? 'INR';
  const symbol = currency === 'INR' ? '₹' : currency + ' ';

  const rawPercent = target > 0 ? (amount / target) * 100 : 0;
  const fillPercent = Math.max(0, Math.min(rawPercent, 100));
  const isComplete = rawPercent >= 100;
  const displayPercent = Math.round(rawPercent);

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
            {symbol}{formatRupees(amount)}
          </div>

          {/* PROGRESS BAR — v3.9.2 */}
          <div
            className="support-progress"
            aria-label={`${displayPercent}% of ${symbol}${formatRupeesShort(target)} quarterly target`}
          >
            <div className="support-progress-bar">
              <div
                className={`support-progress-fill${isComplete ? ' is-complete' : ''}`}
                style={{ width: `${fillPercent}%` }}
              />
            </div>
            <div className="support-progress-meta">
              <span>
                {isComplete
                  ? `Goal reached · ${displayPercent}%`
                  : `${displayPercent}% of ${symbol}${formatRupeesShort(target)}`}
              </span>
              <span>Quarterly</span>
            </div>
          </div>

          <div className="payment-widget-caption">
            Quarterly target supports infrastructure and expanded storage so historical journal weeks stay accessible alongside current intelligence — a continuous, openly maintained record of Indian patent activity.
          </div>

          <button className="payment-widget-button" onClick={handleSupportClick}>
            Support This Project
          </button>

          {successMessage && <p className="payment-success-note">{successMessage}</p>}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-label">Source</div>
          <div className="sidebar-footer-text">
            IP India Patent Journal<br />
            Updated weekly
          </div>
        </div>
      </aside>

      {/* Amount selection modal */}
      {showAmountModal && (
        <div
          className="amount-modal-backdrop"
          onClick={() => !processing && setShowAmountModal(false)}
        >
          <div className="amount-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="amount-modal-close"
              onClick={() => !processing && setShowAmountModal(false)}
              aria-label="Close"
              disabled={processing}
            >
              <X size={16} strokeWidth={2} />
            </button>

            <div className="amount-modal-eyebrow">
              <Heart size={11} strokeWidth={2.2} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Community Support
            </div>
            <h3 className="amount-modal-title">Support this project</h3>
            <p className="amount-modal-subtitle">
              Independent patent intelligence, funded by community goodwill.
              Contributions support ongoing infrastructure and expanded storage.
            </p>

            <div className="amount-modal-presets">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  className="amount-preset"
                  onClick={() => handleContribute(amt)}
                  disabled={processing}
                >
                  ₹{amt.toLocaleString('en-IN')}
                </button>
              ))}
            </div>

            <div className="amount-modal-divider">
              <span>or enter a custom amount</span>
            </div>

            <div className="amount-modal-custom">
              <div className="amount-input-group">
                <span className="amount-input-prefix">₹</span>
                <input
                  type="number"
                  className="amount-input"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  min="1"
                  max="500000"
                  disabled={processing}
                />
              </div>
              <button
                className="amount-submit"
                onClick={() => handleContribute(customAmount)}
                disabled={processing || !customAmount}
              >
                {processing ? 'Processing…' : 'Contribute'}
              </button>
            </div>

            {errorMessage && <p className="amount-modal-error">{errorMessage}</p>}

            <p className="amount-modal-footnote">
              Payments processed securely by Razorpay. No personal data stored.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
