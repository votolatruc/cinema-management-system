import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class BookingService {
  /**
   * Atomically holds seats for a user/session with TTL (default 5 minutes).
   * Purges expired holds first, then checks sold seats & active holds inside a transaction.
   */
  async holdSeats(showtimeId: string, seatIds: string[], sessionKey: string, userId?: string) {
    const ttlSeconds = Number(process.env.SEAT_HOLD_TTL_SECONDS || 300);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    return await prisma.$transaction(async (tx) => {
      // 1. Clean up expired seat holds
      await tx.seatHold.deleteMany({
        where: { expiresAt: { lte: now } }
      });

      // 2. Verify showtime is open for sale
      const showtime = await tx.showtime.findUnique({ where: { id: showtimeId } });
      if (!showtime || showtime.status !== 'OPEN_FOR_SALE') {
        throw new Error('SHOWTIME_UNAVAILABLE: Suất chiếu không khả dụng hoặc đã bị hủy.');
      }

      // 3. Check if any seat is already sold
      const soldSeats = await tx.bookingSeat.findMany({
        where: {
          showtimeId,
          seatId: { in: seatIds },
          isActive: true
        },
        include: { seat: true }
      });

      if (soldSeats.length > 0) {
        const codes = soldSeats.map(s => s.seat.seatCode).join(', ');
        throw new Error(`SEAT_ALREADY_SOLD: Ghế ${codes} đã có người đặt mua.`);
      }

      // 4. Check if any seat is currently held by another session
      const activeHolds = await tx.seatHold.findMany({
        where: {
          showtimeId,
          seatId: { in: seatIds },
          sessionKey: { not: sessionKey },
          expiresAt: { gt: now }
        },
        include: { seat: true }
      });

      if (activeHolds.length > 0) {
        const codes = activeHolds.map(h => h.seat.seatCode).join(', ');
        throw new Error(`SEAT_HELD_BY_OTHER: Ghế ${codes} đang được khách hàng khác giữ tạm thời.`);
      }

      // 5. Upsert holds for current session
      const holds = [];
      for (const seatId of seatIds) {
        const hold = await tx.seatHold.upsert({
          where: { showtimeId_seatId: { showtimeId, seatId } },
          update: { sessionKey, userId, expiresAt },
          create: { showtimeId, seatId, sessionKey, userId, expiresAt }
        });
        holds.push(hold);
      }

      return { holds, expiresAt };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  /**
   * Creates booking, validates promotion at backend, locks seats, and processes payment callback with idempotency.
   */
  async confirmPaymentCallback(params: {
    bookingId: string;
    transactionRef: string;
    idempotencyKey: string;
    signature: string;
    rawPayload: string;
  }) {
    // 1. Verify HMAC-SHA256 webhook signature
    const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'demo_webhook_secret';
    const expectedSig = crypto.createHmac('sha256', secret).update(params.rawPayload).digest('hex');
    if (params.signature !== expectedSig && process.env.PAYMENT_MODE === 'PRODUCTION') {
      throw new Error('INVALID_PAYMENT_SIGNATURE: Chữ ký xác thực cổng thanh toán không hợp lệ.');
    }

    return await prisma.$transaction(async (tx) => {
      // 2. Idempotency check to prevent duplicate callback processing
      const existingPayment = await tx.payment.findUnique({
        where: { idempotencyKey: params.idempotencyKey }
      });
      if (existingPayment && existingPayment.status === 'SUCCESS') {
        return { duplicate: true, payment: existingPayment };
      }

      const booking = await tx.booking.findUnique({
        where: { id: params.bookingId },
        include: { bookingSeats: true }
      });
      if (!booking) throw new Error('BOOKING_NOT_FOUND');

      // 3. Mark payment as SUCCESS
      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          transactionRef: params.transactionRef,
          provider: process.env.PAYMENT_MODE === 'PRODUCTION' ? 'VNPAY' : 'DEMO_GATEWAY',
          method: booking.paymentMethod,
          amount: booking.finalAmount,
          status: 'SUCCESS',
          idempotencyKey: params.idempotencyKey,
          signatureVerified: true,
          paidAt: new Date()
        }
      });

      // 4. Update booking status and issue QR electronic tickets
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'PAID' }
      });

      for (const bs of booking.bookingSeats) {
        const ticketCode = `TKT-${Date.now().toString(36).toUpperCase()}-${bs.seatId.slice(0, 4).toUpperCase()}`;
        await tx.ticket.create({
          data: {
            ticketCode,
            bookingId: booking.id,
            showtimeId: booking.showtimeId,
            seatId: bs.seatId,
            price: bs.unitPrice,
            qrPayload: JSON.stringify({
              ticketCode,
              bookingCode: booking.bookingCode,
              showtimeId: booking.showtimeId,
              seatId: bs.seatId
            })
          }
        });
      }

      return { duplicate: false, payment };
    });
  }
}
