-- Migration 012: Add Google verification flag to consultation_bookings
ALTER TABLE `consultation_bookings`
  ADD COLUMN `is_google_verified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `work_email`;
