/**
 * Consultation booking form options.
 * Shared by the client form (rendering) and the server API (validation),
 * so the allowed values can never drift apart.
 */

export const USER_ROLE_OPTIONS = [
  'Founder / Business Owner',
  'CEO / Director',
  'Sales Manager / Head',
  'Other',
];

export const SALES_TEAM_SIZE_OPTIONS = ['Just me', '2–5 people', '6–10 people', '11+ people'];

export const SALES_CHALLENGE_OPTIONS = [
  'Low lead conversion',
  'Sales strategy and process',
  'Sales team performance',
  'Follow-ups and closing',
  'Need sales execution support',
  'Other',
];
