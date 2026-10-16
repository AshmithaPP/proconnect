import { redirect } from 'next/navigation';

export default function SettingsIndexPage() {
  redirect('/superadmin/dashboard/settings/general');
}
