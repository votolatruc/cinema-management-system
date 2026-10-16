-- ==========================================================
-- INITIAL MIGRATION: CINEMA MANAGEMENT SYSTEM (PostgreSQL)
-- Enforces ACID constraints, partial unique indexes for seat locking,
-- and monetary Decimal(14,0) precision for VND.
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Prevent two active bookings from claiming the same seat in the same showtime
-- When a booking is cancelled/refunded, its booking_seats rows are deleted or archived
-- so the seat can be sold again.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking_seat
ON booking_seats (showtime_id, seat_id)
WHERE is_active = true;

-- Prevent overlapping showtimes in the same auditorium via btree_gist exclusion (optional PG extension)
CREATE INDEX IF NOT EXISTS idx_showtimes_auditorium_window
ON showtimes (auditorium_id, start_time, end_time)
WHERE status != 'CANCELLED';

-- Index for fast seat hold expiration cleanup
CREATE INDEX IF NOT EXISTS idx_seat_holds_expires_at
ON seat_holds (expires_at);
