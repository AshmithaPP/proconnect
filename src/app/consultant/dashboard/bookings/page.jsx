import { BookingsPage } from '@/components/portal/workspace-pages';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bookings — ProConnect Consultant',
  robots: { index: false, follow: false },
};

export default function ConsultantBookingsPage({ searchParams }) {
  return <BookingsPage portalKey="consultant" searchParams={searchParams} />;
}
