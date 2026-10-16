import { BookingsPage } from '@/components/portal/workspace-pages';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bookings — ProConnect Super Admin',
  robots: { index: false, follow: false },
};

export default function SuperAdminBookingsPage({ searchParams }) {
  return <BookingsPage portalKey="superadmin" searchParams={searchParams} />;
}
