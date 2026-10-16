import { AvailabilityPage } from '@/components/portal/workspace-pages';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Availability — ProConnect Super Admin',
  robots: { index: false, follow: false },
};

export default function SuperAdminAvailabilityPage() {
  return <AvailabilityPage portalKey="superadmin" />;
}
