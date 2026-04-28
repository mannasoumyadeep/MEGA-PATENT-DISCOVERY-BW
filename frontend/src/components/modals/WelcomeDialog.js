import { useEffect, useState } from 'react';

export default function WelcomeDialog({ onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('patent-welcome-seen');
    if (hasSeenWelcome) {
      setIsVisible(false);
      onClose();
    }
  }, [onClose]);

  const handleClose = () => {
    localStorage.setItem('patent-welcome-seen', 'true');
    setIsVisible(false);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div
      data-testid="welcome-modal"
      className="modal-overlay"
      onClick={handleClose}
    >
      <div
        className="upload-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        <div className="upload-header" style={{ borderBottom: '2px solid #111' }}>
          <h2
            style={{
              fontFamily: "'Libre Baskerville', serif",
              fontSize: 22,
              fontWeight: 700,
              color: '#111',
            }}
          >
            Welcome to MEGA Patent Discovery
          </h2>
          <button
            className="close-btn"
            onClick={handleClose}
            data-testid="welcome-dismiss-button"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '24px 32px' }}>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: '#5a5a5a',
              marginBottom: 20,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            This dashboard helps you discover high-value patents from the IP India Patent Journal. The
            database starts empty—you control what gets processed.
          </p>

          <div style={{ marginBottom: 16 }}>
            <h3
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#111',
                marginBottom: 8,
              }}
            >
              Getting Started
            </h3>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                fontSize: 13,
                lineHeight: 1.8,
                color: '#5a5a5a',
              }}
            >
              <li style={{ marginBottom: 6 }}>
                <strong style={{ color: '#111' }}>1.</strong> Select a journal from the left panel
              </li>
              <li style={{ marginBottom: 6 }}>
                <strong style={{ color: '#111' }}>2.</strong> Click download or upload PDFs manually
              </li>
              <li style={{ marginBottom: 6 }}>
                <strong style={{ color: '#111' }}>3.</strong> Watch progress as patents are extracted
              </li>
              <li>
                <strong style={{ color: '#111' }}>4.</strong> Explore, filter, and discover MEGA patents
              </li>
            </ul>
          </div>

          <div
            style={{
              padding: 16,
              background: '#f6f6f6',
              borderLeft: '3px solid #111',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                fontWeight: 600,
                color: '#111',
                marginBottom: 4,
              }}
            >
              MEGA Score ≥ 65
            </div>
            <div style={{ fontSize: 12, color: '#5a5a5a', lineHeight: 1.6 }}>
              Patents are scored 0–100 based on claims, pages, and complexity. High scores indicate comprehensive
              documentation and potential innovation depth.
            </div>
          </div>

          <button
            onClick={handleClose}
            className="btn primary"
            style={{ width: '100%', padding: '12px', fontSize: 12 }}
            data-testid="welcome-start-button"
          >
            Start Exploring
          </button>
        </div>
      </div>
    </div>
  );
}
