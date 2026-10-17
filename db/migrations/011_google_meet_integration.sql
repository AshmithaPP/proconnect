-- Add Google Meet link and Calendar event ID to confirmed bookings
ALTER TABLE consultation_bookings
  ADD COLUMN google_meet_link VARCHAR(500) NULL AFTER preferred_time_slot;
ALTER TABLE consultation_bookings
  ADD COLUMN google_calendar_event_id VARCHAR(255) NULL AFTER google_meet_link;
