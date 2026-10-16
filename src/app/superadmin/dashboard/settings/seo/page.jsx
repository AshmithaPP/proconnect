import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import { getSetting } from '@/features/settings/settings.repository';
import SettingsForm from '@/features/settings/components/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SeoSettingsPage() {
  await requirePortalUser('superadmin');
  return <SettingsForm settingKey="seo" initialValue={await getSetting('seo')} />;
}
