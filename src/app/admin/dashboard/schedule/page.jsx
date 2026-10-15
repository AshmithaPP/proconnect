import { SchedulePage } from '@/components/portal/workspace-pages';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Schedule & Pricing — ProConnect Admin',
  robots: { index: false, follow: false },
};

export default function AdminSchedulePage() {
  return <SchedulePage portalKey="admin" />;
}
