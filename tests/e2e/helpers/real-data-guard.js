/**
 * Safety net for e2e tests that run against a database with real bookings.
 *
 * snapshot() records every booking that is NOT test data (date, time, status). verify()
 * compares afterwards; if a test changed a real booking, it is restored exactly and the run
 * is reported as failed — so a test can never silently move or alter a customer's booking.
 */

/** Emails used by test suites — everything else is treated as real data */
const TEST_EMAIL_PATTERNS = ['resched.test.%', 'sched.test.%', 'flow.test.%', 'test.client+%', 'portal.test.%'];

const NOT_TEST_SQL = TEST_EMAIL_PATTERNS.map(() => 'work_email NOT LIKE ?').join(' AND ');

/**
 * @param {import('mysql2/promise').Connection} db
 */
export async function createRealDataGuard(db) {
  const [before] = await db.query(
    `SELECT booking_id, booking_status, reschedule_count, pending_reschedule_reason, preferred_time_slot,
            DATE_FORMAT(consultation_date, '%Y-%m-%d') AS consultation_date,
            TIME_FORMAT(slot_start_time, '%H:%i:%s') AS slot_start_time, TIME_FORMAT(slot_end_time, '%H:%i:%s') AS slot_end_time
     FROM consultation_bookings WHERE ${NOT_TEST_SQL}`,
    TEST_EMAIL_PATTERNS
  );
  const [rescheduleRows] = await db.query('SELECT booking_reschedule_id FROM booking_reschedules');
  const knownReschedules = new Set(rescheduleRows.map((r) => r.booking_reschedule_id));

  return {
    realBookingCount: before.length,

    /** Real confirmed bookings overlapping a daily time window (to pick a safe window for a test) */
    async realBookingsInWindow(fromDate, toDate, startTime, endTime) {
      const [rows] = await db.query(
        `SELECT booking_id FROM consultation_bookings
         WHERE ${NOT_TEST_SQL} AND booking_status = 'confirmed' AND consultation_date BETWEEN ? AND ?
           AND slot_start_time < ? AND slot_end_time > ?`,
        [...TEST_EMAIL_PATTERNS, fromDate, toDate, endTime, startTime]
      );
      return rows.length;
    },

    /**
     * @returns {Promise<string[]>} ids of real bookings that had changed (now restored)
     */
    async verifyAndRestore() {
      const changed = [];
      for (const row of before) {
        const [[now]] = await db.query(
          `SELECT booking_status, reschedule_count,
                  DATE_FORMAT(consultation_date, '%Y-%m-%d') AS consultation_date,
                  TIME_FORMAT(slot_start_time, '%H:%i:%s') AS slot_start_time
           FROM consultation_bookings WHERE booking_id = ?`,
          [row.booking_id]
        );
        if (
          !now ||
          now.booking_status !== row.booking_status ||
          now.consultation_date !== row.consultation_date ||
          now.slot_start_time !== row.slot_start_time ||
          Number(now.reschedule_count) !== Number(row.reschedule_count)
        ) {
          changed.push(row.booking_id);
          if (now) {
            await db.execute(
              `UPDATE consultation_bookings
               SET booking_status = ?, consultation_date = ?, slot_start_time = ?, slot_end_time = ?, preferred_time_slot = ?,
                   reschedule_count = ?, pending_reschedule_reason = ?
               WHERE booking_id = ?`,
              [row.booking_status, row.consultation_date, row.slot_start_time, row.slot_end_time, row.preferred_time_slot,
                row.reschedule_count, row.pending_reschedule_reason, row.booking_id]
            );
          }
        }
      }
      // Remove any history/tokens the test created for real bookings
      if (changed.length) {
        const [rows] = await db.query(
          `SELECT booking_reschedule_id FROM booking_reschedules WHERE booking_id IN (${changed.map(() => '?').join(',')})`,
          changed
        );
        for (const r of rows.filter((x) => !knownReschedules.has(x.booking_reschedule_id))) {
          await db.execute('DELETE FROM booking_reschedules WHERE booking_reschedule_id = ?', [r.booking_reschedule_id]);
        }
      }
      return changed;
    },
  };
}
