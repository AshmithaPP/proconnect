import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import BookingsManager from '@/features/booking/components/BookingsManager';
import AvailabilityCalendar from '@/features/schedule/components/AvailabilityCalendar';
import ScheduleSettingsForm from '@/features/schedule/components/ScheduleSettingsForm';
import { getBookingRules, listWeeklyHours, getBusinessTimezone } from '@/features/schedule/schedule.repository';

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
  const rules = await getBookingRules();
  return (
    <div className="admin-dashboard-full">
      <PageHead
        title="Availability"
        subtitle="Mark days or individual slots when you are not available. Customers can only book open slots."
      />
      <AvailabilityCalendar schedulePath={paths(portalKey).schedule} initialWindowDays={rules.bookingWindowDays} />
    </div>
  );
}

/** @param {{ portalKey: 'admin'|'consultant' }} props */
export async function SchedulePage({ portalKey }) {
  await requirePortalUser(portalKey);
  const [rules, weeklyHours, timezone] = await Promise.all([getBookingRules(), listWeeklyHours(), getBusinessTimezone()]);
  return (
    <div className="admin-dashboard-full">
      <PageHead title="Schedule & Pricing" subtitle="Your fee, how far ahead customers can book, slot length and weekly working hours." />
      <ScheduleSettingsForm initialRules={rules} initialWeeklyHours={weeklyHours} timezone={timezone} />
    </div>
  );
}
