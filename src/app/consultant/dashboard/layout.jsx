import React from 'react';
import PortalShell from '@/components/portal/PortalShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ConsultantDashboardLayout({ children }) {
  return <PortalShell portalKey="consultant">{children}</PortalShell>;
}
