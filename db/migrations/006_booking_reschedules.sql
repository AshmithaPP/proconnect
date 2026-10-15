-- Automatic rescheduling: every move of a booking is recorded, and customers get a secure
-- "choose another time" link.

-- 1. How many times a booking was moved (all causes)
ALTER TABLE consultation_bookings
  ADD COLUMN reschedule_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER slot_end_time;

-- 2. Reschedule history: old → new slot, why, and who moved it
CREATE TABLE IF NOT EXISTS booking_reschedules (
  booking_reschedule_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  booking_id VARCHAR(36) NOT NULL,
  previous_date DATE NOT NULL,
  previous_start_time TIME NOT NULL,
  previous_end_time TIME NOT NULL,
  new_date DATE NOT NULL,
  new_start_time TIME NOT NULL,
  new_end_time TIME NOT NULL,
  reschedule_reason ENUM('slot_taken', 'consultant_unavailable', 'customer_request') NOT NULL,
  rescheduled_by ENUM('system', 'consultant', 'customer') NOT NULL,
  rescheduled_by_user_id VARCHAR(36) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_reschedules_booking
    FOREIGN KEY (booking_id) REFERENCES consultation_bookings (booking_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_booking_reschedules_user
    FOREIGN KEY (rescheduled_by_user_id) REFERENCES portal_users (portal_user_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_booking_reschedules_booking (booking_id, created_at),
  INDEX idx_booking_reschedules_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Customer links ("choose another time"). Only the SHA-256 hash of the token is stored.
CREATE TABLE IF NOT EXISTS booking_access_tokens (
  access_token_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  booking_id VARCHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  token_purpose ENUM('reschedule') NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_access_tokens_booking
    FOREIGN KEY (booking_id) REFERENCES consultation_bookings (booking_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_access_tokens_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
