import React from 'react';
import PortalShell from '@/components/portal/PortalShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminDashboardLayout({ children }) {
  return <PortalShell portalKey="admin">{children}</PortalShell>;
}
