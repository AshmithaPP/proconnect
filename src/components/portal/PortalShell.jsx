import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import PortalSidebar from '@/components/portal/PortalSidebar';
import PortalHeader from '@/components/portal/PortalHeader';

/**
 * Signed-in layout shared by both portals. Verifies the session for THIS portal's role
 * against MySQL (redirecting to its login page otherwise) before rendering anything.
 *
 * @param {{ portalKey: 'admin' | 'consultant', children: React.ReactNode }} props
 */
export default async function PortalShell({ portalKey, children }) {
  const { user } = await requirePortalUser(portalKey);

  return (
    <div className="admin-portal-shell" suppressHydrationWarning>
      <PortalSidebar portalKey={portalKey} user={{ fullName: user.fullName, email: user.email }} />

      <div className="admin-main-wrap">
        <PortalHeader portalKey={portalKey} />
        <main className="admin-content-body">{children}</main>
      </div>
    </div>
  );
}
