import { GoogleMeetPage } from '@/components/portal/workspace-pages';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Google Meet & Calendar — ProConnect Admin',
  robots: { index: false, follow: false },
};

export default function AdminGoogleMeetPage() {
  return <GoogleMeetPage portalKey="admin" />;
}
