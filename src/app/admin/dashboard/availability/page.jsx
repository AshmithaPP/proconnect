import { AvailabilityPage } from '@/components/portal/workspace-pages';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Availability — ProConnect Admin',
  robots: { index: false, follow: false },
};

export default function AdminAvailabilityPage() {
  return <AvailabilityPage portalKey="admin" />;
}
