-- Why a paid booking is waiting for a new slot (status reschedule_required), so the automatic
-- retry tells the customer the right reason when a slot opens up.
ALTER TABLE consultation_bookings
  ADD COLUMN pending_reschedule_reason ENUM('slot_taken', 'consultant_unavailable') NULL DEFAULT NULL AFTER reschedule_count;

UPDATE consultation_bookings SET pending_reschedule_reason = 'slot_taken'
WHERE booking_status = 'reschedule_required' AND pending_reschedule_reason IS NULL;
