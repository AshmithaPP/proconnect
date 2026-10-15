import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import PaidBookingsPanel from '@/features/booking/components/PaidBookingsPanel';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bookings — ProConnect Admin',
  robots: { index: false, follow: false },
};

/** Same paid-bookings view the consultant sees */
export default async function AdminBookingsPage({ searchParams }) {
  await requirePortalUser('admin');
  const resolvedSearchParams = await searchParams;

  return (
    <div className="admin-dashboard-full">
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Bookings</h1>
          <p className="portal-page-subtitle">Consultations that are successfully paid and booked — the same view the consultant has.</p>
        </div>
      </div>
      <PaidBookingsPanel basePath="/admin/dashboard/bookings" page={resolvedSearchParams?.page} />
    </div>
  );
}
