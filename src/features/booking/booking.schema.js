import {
  USER_ROLE_OPTIONS,
  SALES_TEAM_SIZE_OPTIONS,
  SALES_CHALLENGE_OPTIONS,
} from '@/features/booking/booking.options';
import { parseSlotKey } from '@/features/schedule/slot-engine';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ALLOWED_CHARS = /^[+0-9\s().-]+$/;

function cleanText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/**
 * Validate and normalize a consultation booking payload.
 * Returns field-level errors so the form can point at the exact problem.
 * @param {any} body
 * @returns {{ valid: true, booking: object } | { valid: false, error: string, fieldErrors: object }}
 */
export function validateBookingInput(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body', fieldErrors: {} };
  }

  const fullName = cleanText(body.fullName);
  const companyName = cleanText(body.companyName);
  const workEmail = cleanText(body.workEmail).toLowerCase();
  const phoneNumber = cleanText(body.phoneNumber);
  const userRole = cleanText(body.role);
  const userRoleOther = cleanText(body.roleOther);
  const salesTeamSize = cleanText(body.teamSize);
  const salesChallenge = cleanText(body.challenge);
  const salesChallengeOther = cleanText(body.challengeOther);
  // "YYYY-MM-DDTHH:MM" from the availability API; bookability is re-checked by the slot engine
  const slot = parseSlotKey(cleanText(body.slotKey));

  const fieldErrors = {};

  if (fullName.length < 2 || fullName.length > 120) {
    fieldErrors.fullName = 'Full name must be between 2 and 120 characters';
  }

  if (companyName.length < 2 || companyName.length > 160) {
    fieldErrors.companyName = 'Company name must be between 2 and 160 characters';
  }

  if (!EMAIL_REGEX.test(workEmail) || workEmail.length > 255) {
    fieldErrors.workEmail = 'A valid work email is required';
  }

  const phoneDigits = phoneNumber.replace(/\D/g, '');
  if (!PHONE_ALLOWED_CHARS.test(phoneNumber) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    fieldErrors.phoneNumber = 'A valid phone number is required';
  }

  if (!USER_ROLE_OPTIONS.includes(userRole)) {
    fieldErrors.role = 'Please select your role';
  } else if (userRole === 'Other' && (userRoleOther.length < 2 || userRoleOther.length > 120)) {
    fieldErrors.roleOther = 'Please specify your role';
  }

  if (salesTeamSize && !SALES_TEAM_SIZE_OPTIONS.includes(salesTeamSize)) {
    fieldErrors.teamSize = 'Please select a valid team size';
  }

  if (!SALES_CHALLENGE_OPTIONS.includes(salesChallenge)) {
    fieldErrors.challenge = 'Please select your biggest sales challenge';
  } else if (
    salesChallenge === 'Other' &&
    (salesChallengeOther.length < 2 || salesChallengeOther.length > 500)
  ) {
    fieldErrors.challengeOther = 'Please describe your sales challenge';
  }

  if (!slot) {
    fieldErrors.slotKey = 'Please select a date and time slot';
  }

  const errorKeys = Object.keys(fieldErrors);
  if (errorKeys.length > 0) {
    return { valid: false, error: fieldErrors[errorKeys[0]], fieldErrors };
  }

  return {
    valid: true,
    booking: {
      fullName,
      companyName,
      workEmail,
      phoneNumber,
      userRole,
      userRoleOther: userRole === 'Other' ? userRoleOther : null,
      salesTeamSize: salesTeamSize || null,
      salesChallenge,
      salesChallengeOther: salesChallenge === 'Other' ? salesChallengeOther : null,
      consultationDate: slot.date,
      slotStartTime: slot.startTime,
      isGoogleVerified: Boolean(body.isGoogleVerified),
    },
  };
}
