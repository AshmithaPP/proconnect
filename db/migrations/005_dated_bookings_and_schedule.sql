-- Dynamic schedule: bookings get a real date + start/end time (business timezone, wall-clock),
-- slots are generated from weekly hours, and the consultant can block days/slots.

-- 1. Weekly working hours. Several rows per weekday = breaks (e.g. 10:00–13:00 and 14:00–18:30).
--    weekday: 0 = Sunday … 6 = Saturday. A weekday with no rows is closed.
CREATE TABLE IF NOT EXISTS schedule_weekly_hours (
  weekly_hours_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  weekday TINYINT UNSIGNED NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_weekly_hours_weekday CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT chk_weekly_hours_range CHECK (end_time > start_time),
  INDEX idx_weekly_hours_weekday (weekday, start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default hours: 10:00–13:00 and 14:00–22:00 (1–2 PM break), Monday–Saturday (Sunday closed; editable)
INSERT INTO schedule_weekly_hours (weekly_hours_id, weekday, start_time, end_time)
SELECT UUID(), d.weekday, h.start_time, h.end_time
FROM (SELECT 1 AS weekday UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) d
CROSS JOIN (SELECT '10:00:00' AS start_time, '13:00:00' AS end_time UNION ALL SELECT '14:00:00', '22:00:00') h
WHERE NOT EXISTS (SELECT 1 FROM schedule_weekly_hours);

-- 2. Time off: a whole day (start/end NULL) or a time range on one date
CREATE TABLE IF NOT EXISTS schedule_time_off (
  time_off_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  off_date DATE NOT NULL,
  start_time TIME NULL DEFAULT NULL,
  end_time TIME NULL DEFAULT NULL,
  time_off_reason VARCHAR(200) NULL DEFAULT NULL,
  created_by_user_id VARCHAR(36) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_time_off_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES portal_users (portal_user_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_time_off_date (off_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bookings: consultation date + times, and the reschedule status
ALTER TABLE consultation_bookings
  ADD COLUMN consultation_date DATE NULL AFTER preferred_time_slot,
  ADD COLUMN slot_start_time TIME NULL AFTER consultation_date,
  ADD COLUMN slot_end_time TIME NULL AFTER slot_start_time,
  MODIFY COLUMN booking_status ENUM('pending_payment', 'confirmed', 'reschedule_required', 'cancelled')
    NOT NULL DEFAULT 'pending_payment';

-- Existing bookings were always for the day they were made; the label is "10:30 AM – 11:00 AM"
UPDATE consultation_bookings
SET consultation_date = DATE(created_at),
    slot_start_time = TIME(STR_TO_DATE(SUBSTRING_INDEX(preferred_time_slot, ' ', 2), '%h:%i %p')),
    slot_end_time = TIME(STR_TO_DATE(SUBSTRING_INDEX(preferred_time_slot, ' ', -2), '%h:%i %p'))
WHERE consultation_date IS NULL;

ALTER TABLE consultation_bookings
  MODIFY COLUMN consultation_date DATE NOT NULL,
  MODIFY COLUMN slot_start_time TIME NOT NULL,
  MODIFY COLUMN slot_end_time TIME NOT NULL;

-- Older data may hold two confirmed bookings for the same date + slot: keep the first paid,
-- the rest need rescheduling (otherwise the unique guard below cannot be created)
UPDATE consultation_bookings b
JOIN (
  SELECT booking_id FROM (
    SELECT cb.booking_id,
      ROW_NUMBER() OVER (
        PARTITION BY cb.consultation_date, cb.slot_start_time
        ORDER BY
          -- a booking with a real paid payment always wins over one without
          NOT EXISTS (SELECT 1 FROM booking_payments p WHERE p.booking_id = cb.booking_id AND p.payment_status = 'paid'),
          COALESCE(
          (SELECT MIN(p.paid_at) FROM booking_payments p WHERE p.booking_id = cb.booking_id AND p.payment_status = 'paid'),
          cb.created_at
        )
      ) AS slot_rank
    FROM consultation_bookings cb
    WHERE cb.booking_status = 'confirmed'
  ) ranked
  WHERE ranked.slot_rank > 1
) duplicates ON duplicates.booking_id = b.booking_id
SET b.booking_status = 'reschedule_required';

-- 4. Database-level guard: at most ONE confirmed booking per date + start time.
--    Two customers paying for the same slot at the same moment cannot both be confirmed.
ALTER TABLE consultation_bookings
  ADD COLUMN confirmed_slot_key VARCHAR(32)
    GENERATED ALWAYS AS (IF(booking_status = 'confirmed', CONCAT(consultation_date, ' ', slot_start_time), NULL)) STORED,
  ADD UNIQUE KEY uq_confirmed_slot (confirmed_slot_key),
  ADD INDEX idx_booking_consultation_date (consultation_date, booking_status);
