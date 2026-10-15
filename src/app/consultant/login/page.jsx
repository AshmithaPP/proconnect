import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { PORTALS } from '@/features/auth/portals';
import { getPortalUserOrNull } from '@/features/auth/require-portal-user';
import LoginForm from '@/features/auth/components/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Consultant Portal Login — ProConnect',
  description: 'Secure consultant access to bookings, availability and analytics.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ConsultantLoginPage() {
  // If already authenticated, redirect directly to dashboard to save time
  const existingAuth = await getPortalUserOrNull('consultant');
  if (existingAuth) {
    redirect(PORTALS.consultant.homePath);
  }

  return (
    <div className="admin-login-wrapper">
      <Suspense fallback={<div className="text-center py-5">Loading login portal...</div>}>
        <LoginForm portalKey="consultant" />
      </Suspense>
    </div>
  );
}
