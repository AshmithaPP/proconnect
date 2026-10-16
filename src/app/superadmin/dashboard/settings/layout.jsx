import React from 'react';
import SettingsTabs from '@/features/settings/components/SettingsTabs';

export const metadata = {
  title: 'Settings — ProConnect Super Admin',
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }) {
  return (
    <div className="admin-dashboard-full">
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Settings</h1>
          <p className="portal-page-subtitle">Website, SEO, email and integration configuration. Only super administrators can change these.</p>
        </div>
      </div>
      <SettingsTabs />
      {children}
    </div>
  );
}
