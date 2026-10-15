'use client';

import React from 'react';

/** Success / error line under a form, announced to screen readers */
export default function FormStatus({ status }) {
  if (!status) return null;
  return (
    <div className={`form-status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
      {status.message}
    </div>
  );
}
