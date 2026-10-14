-- 1. Consultation Bookings (one row per submitted consultation form)
CREATE TABLE IF NOT EXISTS consultation_bookings (
  booking_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  full_name VARCHAR(120) NOT NULL,
  company_name VARCHAR(160) NOT NULL,
  work_email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(32) NOT NULL,
  user_role VARCHAR(64) NOT NULL,
  user_role_other VARCHAR(120) NULL DEFAULT NULL,
  sales_team_size VARCHAR(32) NULL DEFAULT NULL,
  sales_challenge VARCHAR(64) NOT NULL,
  sales_challenge_other VARCHAR(500) NULL DEFAULT NULL,
  preferred_time_slot VARCHAR(40) NOT NULL,
  booking_status ENUM('pending_payment', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending_payment',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_booking_status_created (booking_status, created_at),
  INDEX idx_booking_work_email (work_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Booking Payments (one row per payment attempt; gateway-agnostic)
CREATE TABLE IF NOT EXISTS booking_payments (
  payment_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  booking_id VARCHAR(36) NOT NULL,
  payment_provider VARCHAR(32) NULL DEFAULT NULL,
  provider_order_id VARCHAR(128) NULL DEFAULT NULL,
  provider_payment_id VARCHAR(128) NULL DEFAULT NULL,
  amount_paise INT UNSIGNED NOT NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'INR',
  payment_status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_payments_booking
    FOREIGN KEY (booking_id) REFERENCES consultation_bookings (booking_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_provider_payment (payment_provider, provider_payment_id),
  INDEX idx_payment_booking (booking_id),
  INDEX idx_payment_status_paid (payment_status, paid_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
