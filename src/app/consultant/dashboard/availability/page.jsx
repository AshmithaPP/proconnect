import { AvailabilityPage } from '@/components/portal/workspace-pages';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Availability — ProConnect Consultant',
  robots: { index: false, follow: false },
};

export default function ConsultantAvailabilityPage() {
  return <AvailabilityPage portalKey="consultant" />;
}
