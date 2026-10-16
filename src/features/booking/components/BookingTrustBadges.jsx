import React from 'react';
import { FiLock, FiClock, FiCheckCircle } from 'react-icons/fi';

export default function BookingTrustBadges() {
  return (
    <div className="trust-badges-bar">
      <div className="trust-badge-item">
        <span className="ic">
          <FiLock />
        </span>
        100% Confidential
      </div>
      <div className="trust-badge-item">
        <span className="ic">
          <FiClock />
        </span>
        24-Hour Response
      </div>
      <div className="trust-badge-item">
        <span className="ic">
          <FiCheckCircle />
        </span>
        Clear Next Steps
      </div>
    </div>
  );
}
