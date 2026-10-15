-- Two portals share one account table:
--   platform_admin → /admin      (our company: SMTP, general settings, SEO, consultant accounts)
--   consultant     → /consultant (the client: bookings, availability, analytics)
-- Existing administrator accounts become platform_admin.

-- 1. Detach sessions from users while both tables are renamed
ALTER TABLE admin_sessions DROP FOREIGN KEY fk_admin_sessions_user;

RENAME TABLE admin_users TO portal_users, admin_sessions TO portal_sessions;

-- 2. Accounts: meaningful id name + role
ALTER TABLE portal_users
  RENAME COLUMN admin_user_id TO portal_user_id,
  RENAME INDEX idx_admin_email_status TO idx_portal_user_email_status;

ALTER TABLE portal_users
  ADD COLUMN user_role ENUM('platform_admin', 'consultant') NOT NULL DEFAULT 'platform_admin' AFTER password_hash;

-- New accounts must always state their role explicitly
ALTER TABLE portal_users ALTER COLUMN user_role DROP DEFAULT;

ALTER TABLE portal_users ADD INDEX idx_portal_user_role_status (user_role, account_status);

-- 3. Sessions: same id name, re-attach to accounts
ALTER TABLE portal_sessions
  RENAME COLUMN admin_user_id TO portal_user_id,
  RENAME INDEX idx_session_user TO idx_session_portal_user;

ALTER TABLE portal_sessions
  ADD CONSTRAINT fk_portal_sessions_user
    FOREIGN KEY (portal_user_id) REFERENCES portal_users (portal_user_id)
    ON DELETE CASCADE ON UPDATE CASCADE;
