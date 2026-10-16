import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { PORTALS } from '@/features/auth/portals';
import { getPortalUserOrNull } from '@/features/auth/require-portal-user';
import LoginForm from '@/features/auth/components/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin Portal Login — ProConnect',
  description: 'Secure administrator access to bookings, availability and analytics.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLoginPage() {
  // If already authenticated, redirect directly to dashboard to save time
  const existingAuth = await getPortalUserOrNull('admin');
  if (existingAuth) {
    redirect(PORTALS.admin.homePath);
  }

  return (
    <div className="admin-login-wrapper">
      <Suspense fallback={<div className="text-center py-5">Loading login portal...</div>}>
        <LoginForm portalKey="admin" />
      </Suspense>
    </div>
  );
}
