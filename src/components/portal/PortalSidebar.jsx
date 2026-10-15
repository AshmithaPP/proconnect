'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/features/auth/components/LogoutButton';
import { DashboardGridIcon } from '@/components/ui/Icons';
import { getPortal } from '@/features/auth/portals';

/** Sidebar links per portal; later phases add bookings, availability, settings… */
const PORTAL_NAV = {
  admin: [{ label: 'Dashboard', href: '/admin/dashboard', Icon: DashboardGridIcon }],
  consultant: [{ label: 'Dashboard', href: '/consultant/dashboard', Icon: DashboardGridIcon }],
};

/**
 * @param {{ portalKey: 'admin' | 'consultant', user: { fullName: string, email: string } }} props
 */
export default function PortalSidebar({ portalKey, user }) {
  const pathname = usePathname();
  const portal = getPortal(portalKey);

  const navItems = PORTAL_NAV[portalKey].map(({ label, href, Icon }) => ({
    label,
    href,
    icon: <Icon className="sidebar-icon" />,
    active: pathname === href,
  }));

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : portal.label.slice(0, 2).toUpperCase();

  return (
    <aside className="admin-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand-box">
        <Link href={portal.homePath} className="sidebar-brand-link">
          <div className="brand-dot" />
          <span className="brand-text">
            ProConnect <span className="brand-badge-pill">{portal.label}</span>
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

      {/* Account Profile Card & Sign Out Footer */}
      <div className="sidebar-footer-profile">
        <div className="sidebar-user-row">
          <div className="user-avatar-circle">{initials}</div>
          <div className="user-info-text">
            <span className="user-name-title" title={user?.fullName}>
              {user?.fullName || portal.label}
            </span>
            <span className="user-email-text" title={user?.email}>
              {user?.email}
            </span>
          </div>
        </div>
        <div className="sidebar-logout-box">
          <LogoutButton portalKey={portalKey} />
        </div>
      </div>
    </aside>
  );
}
