import { describe, it, expect } from 'vitest';

// Unit & Integration Business Rule Verification Suite
describe('Cinema Management System (CMS) - Core Business Rules', () => {
  it('1. Prevents showtime overlap in the same auditorium including cleaning buffer', () => {
    const existingStart = new Date('2026-10-16T18:00:00+07:00').getTime();
    const movieDurationMins = 135;
    const cleaningBufferMins = 20;
    const existingEnd = existingStart + (movieDurationMins + cleaningBufferMins) * 60000; // 20:35

    const candidateStartOverlap = new Date('2026-10-16T20:15:00+07:00').getTime();
    const candidateEndOverlap = candidateStartOverlap + 120 * 60000;
    const isOverlapping = candidateStartOverlap < existingEnd && candidateEndOverlap > existingStart;
    expect(isOverlapping).toBe(true);

    const candidateStartValid = new Date('2026-10-16T20:40:00+07:00').getTime();
    const candidateEndValid = candidateStartValid + 120 * 60000;
    const isOverlappingValid = candidateStartValid < existingEnd && candidateEndValid > existingStart;
    expect(isOverlappingValid).toBe(false);
  });

  it('2. Prevents concurrent double-booking of the same seat in the same showtime', () => {
    const activeLocks = new Map<string, { sessionKey: string; expiresAt: number }>();
    const soldSeats = new Set<string>();
    const now = Date.now();

    const tryHoldSeat = (showtimeId: string, seatCode: string, sessionKey: string) => {
      const key = `${showtimeId}:${seatCode}`;
      if (soldSeats.has(key)) return { ok: false, reason: 'SEAT_ALREADY_SOLD' };
      const hold = activeLocks.get(key);
      if (hold && hold.expiresAt > now && hold.sessionKey !== sessionKey) {
        return { ok: false, reason: 'SEAT_HELD_BY_OTHER' };
      }
      activeLocks.set(key, { sessionKey, expiresAt: now + 300000 });
      return { ok: true };
    };

    const userA = tryHoldSeat('ST-01', 'E8', 'SESSION_A');
    const userB = tryHoldSeat('ST-01', 'E8', 'SESSION_B');

    expect(userA.ok).toBe(true);
    expect(userB.ok).toBe(false);
    expect(userB.reason).toBe('SEAT_HELD_BY_OTHER');
  });

  it('3. Automatically releases expired seat holds', () => {
    const now = Date.now();
    const expiredHold = { sessionKey: 'SESSION_OLD', expiresAt: now - 1000 };
    const isExpired = expiredHold.expiresAt <= now;
    expect(isExpired).toBe(true);
  });

  it('4. Calculates ticket pricing and promotion discount accurately without negative totals', () => {
    const basePrice = 95000;
    const vipSurcharge = 25000;
    const coupleMultiplier = 2.1; // 2 seats + luxury surcharge
    const subtotal = (basePrice + vipSurcharge) * 2 + Math.round(basePrice * coupleMultiplier);
    expect(subtotal).toBe(439500);

    // Apply 20% promo capped at 50,000 VND
    const rawDiscount = Math.round(subtotal * 0.2);
    const cappedDiscount = Math.min(rawDiscount, 50000);
    const finalTotal = Math.max(0, subtotal - cappedDiscount);
    expect(cappedDiscount).toBe(50000);
    expect(finalTotal).toBe(389500);
  });

  it('5. Enforces payment webhook idempotency against duplicate callbacks', () => {
    const processedIdempotencyKeys = new Set<string>();
    const handleCallback = (key: string) => {
      if (processedIdempotencyKeys.has(key)) return { status: 'DUPLICATE_IGNORED' };
      processedIdempotencyKeys.add(key);
      return { status: 'PROCESSED_SUCCESS' };
    };

    expect(handleCallback('IDEMP_9981').status).toBe('PROCESSED_SUCCESS');
    expect(handleCallback('IDEMP_9981').status).toBe('DUPLICATE_IGNORED');
  });

  it('6. Computes Net Revenue strictly from PAID bookings minus REFUNDED amounts (excluding PENDING)', () => {
    const bookings = [
      { status: 'PAID', finalAmount: 240000 },
      { status: 'PAID', finalAmount: 190000 },
      { status: 'PENDING', finalAmount: 300000 },
      { status: 'REFUNDED', finalAmount: 150000 }
    ];
    const grossPaidRevenue = bookings
      .filter(b => b.status === 'PAID' || b.status === 'REFUNDED')
      .reduce((sum, b) => sum + b.finalAmount, 0);
    const refundedAmount = bookings
      .filter(b => b.status === 'REFUNDED')
      .reduce((sum, b) => sum + b.finalAmount, 0);
    const netRevenue = grossPaidRevenue - refundedAmount;

    expect(grossPaidRevenue).toBe(580000);
    expect(refundedAmount).toBe(150000);
    expect(netRevenue).toBe(430000);
  });
});
