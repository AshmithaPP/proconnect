import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const rawSession = cookieStore.get('customer_google_session')?.value;

  if (!rawSession) {
    return NextResponse.json({ authenticated: false, user: null }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const user = JSON.parse(rawSession);
    return NextResponse.json({ authenticated: true, user }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    cookieStore.delete('customer_google_session');
    return NextResponse.json({ authenticated: false, user: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('customer_google_session');
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}
