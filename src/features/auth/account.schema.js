/**
 * Validation for portal accounts (create / edit / password). Client-safe, shared by the
 * forms and the API. Password rules mirror password.js (bcrypt-safe: 10 chars – 72 bytes).
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_CHARS = 10;
const MAX_PASSWORD_BYTES = 72;

/** @returns {string | null} error message */
export function checkPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_CHARS) {
    return `Password must be at least ${MIN_PASSWORD_CHARS} characters`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return `Password must not exceed ${MAX_PASSWORD_BYTES} bytes`;
  }
  return null;
}

/**
 * @param {object} input
 * @param {{ requirePassword: boolean }} options
 * @returns {{ value: { fullName: string, email: string, password?: string }, fieldErrors: Record<string, string> }}
 */
export function validateAccountInput(input, { requirePassword }) {
  const body = input && typeof input === 'object' ? input : {};
  const fieldErrors = {};
  const value = {
    fullName: typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 255) : '',
    email: typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 255) : '',
  };
  if (!value.fullName) fieldErrors.fullName = 'Name is required';
  if (!EMAIL_REGEX.test(value.email)) fieldErrors.email = 'Enter a valid email';
  if (requirePassword) {
    const passwordError = checkPassword(body.password);
    if (passwordError) fieldErrors.password = passwordError;
    else value.password = body.password;
  }
  return { value, fieldErrors };
}
