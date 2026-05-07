import React from 'react';
import { ArrowRight, Lock } from 'lucide-react';

export default function PaidNotice({ onLearnMore }) {
  return (
    <div className="paid-notice">
      <div className="paid-notice-left">
        <Lock className="paid-icon" size={14} strokeWidth={1.8} />
        <span className="paid-label">Reimbursement Required for Data Access</span>
        <span className="paid-text">
          Access to detailed patent data, full reports, and downloads is available based
          on your reimbursement balance.
        </span>
      </div>
      <span className="paid-link" onClick={onLearnMore}>
        Learn More <ArrowRight size={11} strokeWidth={2} />
      </span>
    </div>
  );
}
