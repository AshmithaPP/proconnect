import React from 'react';
import AccountPage from '@/features/auth/components/AccountPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My Account — ProConnect Consultant',
  robots: { index: false, follow: false },
};

export default function ConsultantAccountPage() {
  return <AccountPage portalKey="consultant" />;
}
