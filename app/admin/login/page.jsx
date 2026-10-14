import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedAdminOrNull } from '@/lib/auth/require-admin';
import LoginForm from '@/components/admin/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin Portal Login — ProConnect',
  description: 'Secure administrator access portal for ProConnect.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLoginPage() {
  // If already authenticated, redirect directly to dashboard to save time
  const existingAuth = await getAuthenticatedAdminOrNull();
  if (existingAuth) {
    redirect('/admin/dashboard');
  }

  return (
    <div className="admin-login-wrapper">
      <Suspense fallback={<div className="text-center py-5">Loading login portal...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
