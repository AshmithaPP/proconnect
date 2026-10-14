import React from 'react';
import Link from 'next/link';
import LogoutButton from './LogoutButton';

export default function AdminNav({ admin }) {
  return (
    <header className="admin-nav-bar">
      <div className="container d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-3">
          <Link href="/admin/dashboard" className="brand-name" style={{ fontSize: '1.1rem' }}>
            ProConnect <span>Admin</span>
          </Link>
          <span className="admin-tag-pill">ADMIN</span>
        </div>

        <div className="d-flex align-items-center gap-4">
          <Link
            href="/"
            className="public-site-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            ↗ Public Website
          </Link>
          <div className="admin-profile-meta">
            <span className="admin-meta-name">{admin.fullName}</span>
            <span className="admin-meta-email">{admin.email}</span>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
