import React from 'react';
import { LockIcon, ClockIcon, CheckCircleIcon } from '@/components/ui/Icons';

export default function BookingTrustBadges() {
  return (
    <div className="trust-badges-bar">
      <div className="trust-badge-item">
        <span className="ic">
          <LockIcon />
        </span>
        100% Confidential
      </div>
      <div className="trust-badge-item">
        <span className="ic">
          <ClockIcon />
        </span>
        24-Hour Response
      </div>
      <div className="trust-badge-item">
        <span className="ic">
          <CheckCircleIcon />
        </span>
        Clear Next Steps
      </div>
    </div>
  );
}
