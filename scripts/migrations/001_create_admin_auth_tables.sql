-- 1. Migration Tracking Table
CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Administrator Accounts Table
CREATE TABLE IF NOT EXISTS admin_users (
  admin_user_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  account_status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_admin_email_status (email, account_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Persistent Sessions Table (with Sliding & Absolute Expiry)
CREATE TABLE IF NOT EXISTS admin_sessions (
  session_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  admin_user_id VARCHAR(36) NOT NULL,
  session_token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  absolute_expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_admin_sessions_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users (admin_user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_session_lookup (session_token_hash, revoked_at, expires_at),
  INDEX idx_session_user (admin_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Shared Persistent Rate Limiting Table
CREATE TABLE IF NOT EXISTS rate_limits (
  rate_limit_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  client_key VARCHAR(128) NOT NULL,
  action VARCHAR(64) NOT NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  blocked_until TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uq_client_action (client_key, action),
  INDEX idx_blocked (blocked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
