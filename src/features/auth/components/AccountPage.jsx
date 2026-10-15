import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import { getPortal } from '@/features/auth/portals';
import ChangePasswordForm from '@/features/auth/components/ChangePasswordForm';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}

/**
 * "My Account" page, identical in both portals.
 * @param {{ portalKey: 'admin' | 'consultant' }} props
 */
export default async function AccountPage({ portalKey }) {
  const { user } = await requirePortalUser(portalKey);
  const portal = getPortal(portalKey);

  return (
    <div className="admin-dashboard-full">
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">My Account</h1>
          <p className="portal-page-subtitle">Your sign-in details for the {portal.label.toLowerCase()} portal.</p>
        </div>
      </div>

      <div className="admin-kpi-grid">
        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Name</span>
          </div>
          <div className="card-val">{user.fullName}</div>
        </div>
        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Email</span>
          </div>
          <div className="card-val" style={{ wordBreak: 'break-all' }}>{user.email}</div>
        </div>
        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Role</span>
          </div>
          <div className="card-val">{portalKey === 'admin' ? 'Platform admin' : 'Consultant'}</div>
        </div>
        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Last Login</span>
          </div>
          <div className="card-val">{formatDateTime(user.lastLoginAt)}</div>
        </div>
      </div>

      <ChangePasswordForm portalKey={portalKey} />
    </div>
  );
}
