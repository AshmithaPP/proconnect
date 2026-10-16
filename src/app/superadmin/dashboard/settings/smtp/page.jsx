import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SmtpSettingsPage() {
  redirect('/superadmin/dashboard/settings/general');
}
