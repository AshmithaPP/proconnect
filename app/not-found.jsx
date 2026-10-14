import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card text-center">
        <h1 style={{ fontSize: '3rem', color: 'var(--color-primary)' }}>404</h1>
        <h2>Page Not Found</h2>
        <p style={{ margin: '14px 0 24px' }}>
          The page you requested does not exist or has been moved.
        </p>
        <Link href="/" className="btn-pro btn-orange">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
