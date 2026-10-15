-- Consultations are always 30 minutes now (SLOT_MINUTES in the slot engine) — not a setting
UPDATE site_settings
SET setting_value = JSON_REMOVE(setting_value, '$.slotDurationMinutes')
WHERE setting_key = 'booking_rules';
