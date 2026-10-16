import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import BookingsManager from '@/features/booking/components/BookingsManager';
import AvailabilityCalendar from '@/features/schedule/components/AvailabilityCalendar';
import ScheduleSettingsForm from '@/features/schedule/components/ScheduleSettingsForm';
import GoogleMeetSettings from '@/features/settings/components/GoogleMeetSettings';
import { getBookingRules, getBusinessTimezone } from '@/features/schedule/schedule.repository';
import { BUSINESS_HOURS } from '@/features/schedule/slot-engine';

/*
 * Workspace pages shared by both portals (the platform admin has every consultant feature).
 * Each route file is a one-liner passing its portal; links stay inside that portal.
 */

const paths = (portalKey) => ({
  bookings: `/${portalKey}/dashboard/bookings`,
  availability: `/${portalKey}/dashboard/availability`,
  schedule: `/${portalKey}/dashboard/schedule`,
});

function PageHead({ title, subtitle }) {
  return (
    <div className="portal-page-head">
      <div>
        <h1 className="portal-page-title">{title}</h1>
        <p className="portal-page-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}

/** @param {{ portalKey: 'admin'|'consultant', searchParams: Promise<object> }} props */
export async function BookingsPage({ portalKey, searchParams }) {
  await requirePortalUser(portalKey);
  const params = await searchParams;
  return (
    <div className="admin-dashboard-full">
      <PageHead title="Bookings" subtitle="Paid consultations by date. Times are in the business timezone." />
      <BookingsManager basePath={paths(portalKey).bookings} view={params?.view} page={params?.page} q={params?.q} />
    </div>
  );
}

/** @param {{ portalKey: 'admin'|'consultant' }} props */
export async function AvailabilityPage({ portalKey }) {
  await requirePortalUser(portalKey);
  return (
    <div className="admin-dashboard-full">
      <PageHead title="Availability" subtitle="Choose when customers can book you." />
      <AvailabilityCalendar portalKey={portalKey} />
    </div>
  );
}

/** @param {{ portalKey: 'admin'|'consultant' }} props */
export async function SchedulePage({ portalKey }) {
  await requirePortalUser(portalKey);
  const [rules, timezone] = await Promise.all([getBookingRules(), getBusinessTimezone()]);
  return (
    <div className="admin-dashboard-full">
      <PageHead title="Schedule & Pricing" subtitle="Your fee and how far ahead customers can book." />
      <ScheduleSettingsForm
        initialRules={rules}
        businessHours={BUSINESS_HOURS}
        timezone={timezone}
        availabilityPath={paths(portalKey).availability}
      />
    </div>
  );
}

/** @param {{ portalKey: 'admin'|'consultant' }} props */
export async function GoogleMeetPage({ portalKey }) {
  await requirePortalUser(portalKey);
  return (
    <div className="admin-dashboard-full">
      <PageHead
        title="Google Meet & Calendar"
        subtitle="Manage your Google Calendar connection and automated Google Meet scheduling."
      />
      <GoogleMeetSettings portalKey={portalKey} />
    </div>
  );
}
