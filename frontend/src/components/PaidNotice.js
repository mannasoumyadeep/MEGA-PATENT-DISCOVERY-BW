import React from 'react';
import { Lock } from 'lucide-react';

export default function PaidNotice() {
  return (
    <div className="paid-notice">
      <div className="paid-notice-left">
        <Lock className="paid-icon" size={14} strokeWidth={1.8} />
        <span className="paid-label">Premium Data Access</span>
        <span className="paid-text">
          Detailed patent reports and bulk downloads require an active reimbursement balance.
        </span>
      </div>
    </div>
  );
}
