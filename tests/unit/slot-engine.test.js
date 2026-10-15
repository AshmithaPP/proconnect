/**
 * Slot engine unit tests (pure functions, no server/DB).
 * Usage: npm run test:slots
 */
import {
  buildAvailability,
  toPublicAvailability,
  parseSlotKey,
  getZonedNow,
  addDays,
  weekdayOf,
  formatSlotLabel,
} from '../../src/features/schedule/slot-engine.js';

let passed = 0;
let failed = 0;
function assert(condition, name, detail) {
  if (condition) {
    console.log(`✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${name}`, detail ?? '');
    failed++;
  }
}

const TZ = 'Asia/Kolkata';
const RULES = { bookingWindowDays: 7, minNoticeMinutes: 60, slotDurationMinutes: 30, slotGapMinutes: 0 };
const WEEKDAY_HOURS = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
  { weekday, startTime: '10:00', endTime: '13:00' },
  { weekday, startTime: '14:00', endTime: '18:30' },
]);
// Thu 15 Oct 2026, 09:00 IST
const NOW = new Date('2026-10-15T03:30:00Z');
const build = (overrides = {}) =>
  buildAvailability({ rules: RULES, weeklyHours: WEEKDAY_HOURS, timeOff: [], bookings: [], timezone: TZ, now: NOW, ...overrides });

// --- calendar helpers ---
assert(addDays('2026-10-31', 1) === '2026-11-01' && addDays('2026-03-01', -1) === '2026-02-28', 'addDays crosses month boundaries');
assert(weekdayOf('2026-10-18') === 0 && weekdayOf('2026-10-19') === 1, 'weekdayOf: 18 Oct 2026 is Sunday');
assert(formatSlotLabel('10:30', '11:00') === '10:30 AM – 11:00 AM' && formatSlotLabel('12:00', '12:30') === '12:00 PM – 12:30 PM', 'Slot labels match the original format');
const late = getZonedNow(TZ, new Date('2026-10-15T20:00:00Z'));
assert(late.date === '2026-10-16' && late.minutes === 90, 'Business date follows the timezone (20:00 UTC = 01:30 next day IST)', late);
assert(parseSlotKey('2026-10-16T10:30')?.startTime === '10:30' && parseSlotKey('2026-10-16 10:30') === null && parseSlotKey('x') === null, 'parseSlotKey accepts only YYYY-MM-DDTHH:MM');

// --- window + weekly hours ---
let days = build();
assert(days.length === 7 && days[0].date === '2026-10-15' && days[6].date === '2026-10-21', 'Window = today + 6 days');
assert(days[0].slots.length === 15, 'Weekday 10–13 + 14–18:30 at 30 min = 15 slots (same as the old fixed list)');
assert(days.find((d) => d.date === '2026-10-18').isClosed, 'Sunday without weekly hours is closed');
assert(build({ rules: { ...RULES, bookingWindowDays: 14 } }).length === 14, 'Window length is dynamic');

// --- minimum notice / past ---
const today = days[0];
assert(today.slots.find((s) => s.startTime === '10:00').status === 'available', '10:00 is open at 09:00 with 1h notice');
const at1010 = build({ now: new Date('2026-10-15T04:40:00Z') })[0]; // 10:10 IST
assert(at1010.slots.find((s) => s.startTime === '11:00').status === 'past' && at1010.slots.find((s) => s.startTime === '11:30').status === 'available',
  'At 10:10 with 1h notice, 11:00 is past and 11:30 open');

// --- slot length + gap ---
days = build({ rules: { ...RULES, slotDurationMinutes: 45, slotGapMinutes: 15 } });
assert(days[1].slots.map((s) => s.startTime).join(',') === '10:00,11:00,12:00,14:00,15:00,16:00,17:00',
  '45-min slots with 15-min break', days[1].slots.map((s) => s.startTime));

// --- bookings ---
const booking = { bookingId: 'b1', consultationDate: '2026-10-16', slotStartTime: '10:30', slotEndTime: '11:00', fullName: 'Riya', companyName: 'Acme' };
days = build({ bookings: [booking] });
let slot = days[1].slots.find((s) => s.startTime === '10:30');
assert(slot.status === 'booked' && slot.booking.fullName === 'Riya', 'Paid booking marks its slot booked');
assert(days[1].availableCount === 14, 'Booked slot is not counted as open');
days = build({ bookings: [booking], rules: { ...RULES, slotDurationMinutes: 60 } });
assert(days[1].slots.find((s) => s.startTime === '10:00').status === 'booked', 'After switching to 60-min slots, the overlapping 10:00–11:00 slot is booked');
days = build({ bookings: [{ ...booking, slotStartTime: '19:00', slotEndTime: '19:30' }] });
slot = days[1].slots.find((s) => s.startTime === '19:00');
assert(slot?.status === 'booked' && slot.outsideHours, 'A booking outside current hours stays visible (never silently dropped)');

// --- time off ---
days = build({ timeOff: [{ timeOffId: 't1', offDate: '2026-10-16', startTime: null, endTime: null, timeOffReason: 'Holiday' }] });
assert(days[1].isDayOff && days[1].availableCount === 0 && days[1].slots.every((s) => s.status === 'blocked'), 'Whole-day time off blocks every slot');
days = build({ timeOff: [{ timeOffId: 't2', offDate: '2026-10-16', startTime: '14:00', endTime: '15:00' }] });
const blocked = days[1].slots.filter((s) => s.status === 'blocked').map((s) => s.startTime);
assert(blocked.join(',') === '14:00,14:30' && days[1].slots.find((s) => s.startTime === '14:00').timeOffId === 't2', 'Range time off blocks only overlapping slots', blocked);
days = build({ bookings: [booking], timeOff: [{ timeOffId: 't3', offDate: '2026-10-16', startTime: null, endTime: null }] });
assert(days[1].slots.find((s) => s.startTime === '10:30').status === 'booked', 'A paid booking wins over time off (shown as booked)');

// --- public view ---
const publicDays = toPublicAvailability(build({ bookings: [booking], timeOff: [{ timeOffId: 't2', offDate: '2026-10-16', startTime: '14:00', endTime: '15:00' }] }));
const json = JSON.stringify(publicDays);
assert(!json.includes('Riya') && !json.includes('t2') && !json.includes('timeOffId'), 'Public availability exposes no client names or time-off ids');
assert(publicDays[1].slots.find((s) => s.slotKey === '2026-10-16T14:00').status === 'unavailable' && publicDays[1].slots.find((s) => s.slotKey === '2026-10-16T10:30').status === 'booked',
  'Public statuses: available / booked / unavailable');

console.log(`\nRESULTS: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
