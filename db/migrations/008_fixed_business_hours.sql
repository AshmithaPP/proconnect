-- Simplified schedule: business hours are fixed in code (10:00–13:00 and 14:00–22:00, every
-- day — see BUSINESS_HOURS in the slot engine), slots run back to back and can be booked until
-- they start. Days/times off stay in schedule_time_off (Availability page).

DROP TABLE IF EXISTS schedule_weekly_hours;

-- Booking rules that no longer exist
UPDATE site_settings
SET setting_value = JSON_REMOVE(setting_value, '$.minNoticeMinutes', '$.slotGapMinutes')
WHERE setting_key = 'booking_rules';
