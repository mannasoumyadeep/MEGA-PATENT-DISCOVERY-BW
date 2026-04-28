import { useState, useEffect } from "react";
import "./WelcomeModal.css";

export default function WelcomeModal({ onClose }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hasVisited = localStorage.getItem("hasVisited");
    if (!hasVisited) {
      setTimeout(() => setShow(true), 500);
    }
  }, []);

  const handleClose = () => {
    setShow(false);
    localStorage.setItem("hasVisited", "true");
    setTimeout(onClose, 300);
  };

  if (!show) return null;

  return (
    <div className={`welcome-overlay ${show ? "active" : ""}`} onClick={handleClose}>
      <div className="welcome-modal" onClick={e => e.stopPropagation()}>
        <div className="welcome-header">
          <div className="welcome-icon">🔍</div>
          <h1>Discover India's MEGA Patents</h1>
          <p className="welcome-subtitle">Identifying High-Value Innovation from IP India</p>
        </div>

        <div className="welcome-content">
          <div className="welcome-section">
            <div className="feature-icon">💎</div>
            <h3>What are MEGA Patents?</h3>
            <p>
              Patents with <strong>≥15 claims</strong> and <strong>≥50 pages</strong> represent comprehensive, 
              well-documented innovations with significant commercial potential. These are the patents that 
              matter most to investors, researchers, and industry leaders.
            </p>
          </div>

          <div className="welcome-section">
            <div className="feature-icon">🎯</div>
            <h3>Why This Matters</h3>
            <p>
              India publishes <strong>thousands of patents weekly</strong>, but finding the truly valuable ones 
              is like finding needles in a haystack. Our platform automatically processes IPO India journal PDFs, 
              extracts all patent data, and scores each patent based on claims depth, documentation completeness, 
              and technical complexity.
            </p>
          </div>

          <div className="welcome-section">
            <div className="feature-icon">⚡</div>
            <h3>What You Can Do</h3>
            <ul className="feature-list">
              <li><strong>Browse MEGA Patents:</strong> Sorted by our proprietary scoring algorithm (0-100)</li>
              <li><strong>Filter by Technology:</strong> AI, Biotech, Electronics, and 15+ other fields</li>
              <li><strong>Geographic Analysis:</strong> See innovation hotspots across India's cities</li>
              <li><strong>Upload Journals:</strong> Manually upload PDFs if latest journals aren't auto-fetched</li>
              <li><strong>Resizable Dashboard:</strong> Customize your view to focus on what matters to you</li>
            </ul>
          </div>

          <div className="welcome-section highlight">
            <div className="feature-icon">🚀</div>
            <h3>Getting Started</h3>
            <p>
              Click <strong>"Refresh"</strong> to load the latest journals from IPO India, or use the 
              <strong> "Get"</strong> button next to any journal to download and process it. 
              Processing takes 5-15 minutes per journal depending on size.
            </p>
          </div>
        </div>

        <div className="welcome-footer">
          <button className="welcome-btn" onClick={handleClose}>
            Start Exploring MEGA Patents →
          </button>
          <p className="welcome-note">
            This is an independent tool. Data sourced from <a href="https://search.ipindia.gov.in" target="_blank" rel="noopener noreferrer">IP India</a>
          </p>
        </div>
      </div>
    </div>
  );
}
