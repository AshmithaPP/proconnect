import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SuperAdminGoogleMeetPage() {
  redirect('/superadmin/dashboard/settings/google-meet');
}
