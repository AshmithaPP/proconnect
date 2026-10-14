import React from 'react';
import { ClockIcon, CalendarIcon, MessageIcon, LockIcon } from '@/components/ui/Icons';

export default function InfoGrid() {
  return (
    <div className="info-grid reveal d3">
      <div className="info-box">
        <div className="lbl">
          <ClockIcon /> Format
        </div>
        <div className="val">1-to-1 Consultation</div>
      </div>

      <div className="info-box">
        <div className="lbl">
          <CalendarIcon /> Focus
        </div>
        <div className="val">Sales Strategy &amp; Process</div>
      </div>

      <div className="info-box">
        <div className="lbl">
          <MessageIcon /> Outcome
        </div>
        <div className="val">Clear Next Steps</div>
      </div>

      <div className="info-box">
        <div className="lbl">
          <LockIcon /> Privacy
        </div>
        <div className="val">100% Confidential</div>
      </div>
    </div>
  );
}
