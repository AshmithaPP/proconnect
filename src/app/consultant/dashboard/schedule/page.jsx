import { SchedulePage } from '@/components/portal/workspace-pages';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Schedule & Pricing — ProConnect Consultant',
  robots: { index: false, follow: false },
};

export default function ConsultantSchedulePage() {
  return <SchedulePage portalKey="consultant" />;
}
