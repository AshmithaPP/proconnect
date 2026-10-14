'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/features/auth/components/LogoutButton';
import { DashboardGridIcon } from '@/components/ui/Icons';

export default function AdminSidebar({ admin }) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Dashboard',
      href: '/admin/dashboard',
      icon: <DashboardGridIcon className="sidebar-icon" />,
      active: pathname === '/admin/dashboard',
    },
  ];

  const initials = admin?.fullName
    ? admin.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'AD';

  return (
    <aside className="admin-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand-box">
        <Link href="/admin/dashboard" className="sidebar-brand-link">
          <div className="brand-dot" />
          <span className="brand-text">
            ProConnect <span className="brand-badge-pill">Admin</span>
          </span>
        </Link>
      </div>

      {/* Main Navigation - Dashboard only */}
      <div className="sidebar-content-scroll">
        <div className="sidebar-section-group">
          <span className="sidebar-section-title">NAVIGATION</span>
          <ul className="sidebar-nav-list">
            {navItems.map((item, idx) => (
              <li key={idx} className="sidebar-nav-item">
                <Link
                  href={item.href}
                  className={`sidebar-nav-link ${item.active ? 'active' : ''}`}
                >
                  <span className="link-icon-wrap">{item.icon}</span>
                  <span className="link-label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Administrator Profile Card & Sign Out Footer */}
      <div className="sidebar-footer-profile">
        <div className="sidebar-user-row">
          <div className="user-avatar-circle">{initials}</div>
          <div className="user-info-text">
            <span className="user-name-title" title={admin?.fullName}>
              {admin?.fullName || 'Administrator'}
            </span>
            <span className="user-email-text" title={admin?.email}>
              {admin?.email || 'admin@preconnect.com'}
            </span>
          </div>
        </div>
        <div className="sidebar-logout-box">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
