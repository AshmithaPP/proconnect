import React from 'react';
import { requireAdmin } from '@/lib/auth/require-admin';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminDashboardLayout({ children }) {
  // Server-side authentication gate
  const auth = await requireAdmin();

  return (
    <div className="admin-portal-shell">
      {/* Sleek Left Sidebar */}
      <AdminSidebar admin={auth.admin} />

      {/* Full-Width Main Area */}
      <div className="admin-main-wrap">
        <AdminHeader admin={auth.admin} />
        <main className="admin-content-body">
          {children}
        </main>
      </div>
    </div>
  );
}
