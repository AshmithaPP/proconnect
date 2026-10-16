import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import GoogleMeetSettings from '@/features/settings/components/GoogleMeetSettings';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Google Meet Settings — ProConnect Super Admin',
  robots: { index: false, follow: false },
};

export default async function GoogleMeetSettingsPage() {
  await requirePortalUser('superadmin');
  return <GoogleMeetSettings portalKey="superadmin" />;
}
