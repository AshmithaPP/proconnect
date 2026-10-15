import { redirect } from 'next/navigation';

export default function SettingsIndexPage() {
  redirect('/admin/dashboard/settings/general');
}
