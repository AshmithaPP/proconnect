import { BookingsPage } from '@/components/portal/workspace-pages';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bookings — ProConnect Admin',
  robots: { index: false, follow: false },
};

export default function AdminBookingsPage({ searchParams }) {
  return <BookingsPage portalKey="admin" searchParams={searchParams} />;
}
