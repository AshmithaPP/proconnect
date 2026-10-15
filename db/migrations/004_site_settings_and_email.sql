-- 1. Site settings: one JSON document per area, edited in the admin portal.
--    Keys: general, seo, smtp (smtp.password is AES-256-GCM encrypted by the app).
--    Defaults live in code (features/settings/settings.definitions.js); a missing row = defaults.
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(64) PRIMARY KEY,
  setting_value JSON NOT NULL,
  updated_by_user_id VARCHAR(36) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_site_settings_updated_by
    FOREIGN KEY (updated_by_user_id) REFERENCES portal_users (portal_user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Email templates edited by the admin. Default wording lives in code
--    (features/email/email-templates.js); a row here overrides it, deleting it resets to default.
CREATE TABLE IF NOT EXISTS email_templates (
  template_key VARCHAR(64) PRIMARY KEY,
  email_subject VARCHAR(255) NOT NULL,
  body_html MEDIUMTEXT NOT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_by_user_id VARCHAR(36) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_email_templates_updated_by
    FOREIGN KEY (updated_by_user_id) REFERENCES portal_users (portal_user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Delivery log: every email the app tried to send (sent / failed / skipped when SMTP is off)
CREATE TABLE IF NOT EXISTS email_deliveries (
  email_delivery_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  template_key VARCHAR(64) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  email_subject VARCHAR(255) NOT NULL,
  delivery_status ENUM('sent', 'failed', 'skipped') NOT NULL,
  error_message VARCHAR(500) NULL DEFAULT NULL,
  provider_message_id VARCHAR(255) NULL DEFAULT NULL,
  booking_id VARCHAR(36) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_email_deliveries_booking
    FOREIGN KEY (booking_id) REFERENCES consultation_bookings (booking_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_email_delivery_created (created_at),
  INDEX idx_email_delivery_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
