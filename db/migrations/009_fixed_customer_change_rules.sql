-- Customer change limits are fixed in code now (12 hours before, max 2 changes) — not settings
UPDATE site_settings
SET setting_value = JSON_REMOVE(setting_value, '$.customerRescheduleCutoffHours', '$.maxCustomerReschedules')
WHERE setting_key = 'booking_rules';
