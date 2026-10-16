import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateShowtimeInput {
  movieId: string;
  auditoriumId: string;
  showDate: string; // YYYY-MM-DD
  startTimeIso: string;
  format: string;
  basePrice: number;
  cleaningBufferMinutes?: number;
}

export class ShowtimeService {
  /**
   * Creates a showtime after calculating endTime = startTime + movie.durationMinutes + cleaningBufferMinutes
   * and validating zero time-overlap in the same auditorium.
   */
  async createShowtime(input: CreateShowtimeInput, actor: { id: string; name: string; role: string }) {
    const movie = await prisma.movie.findUnique({ where: { id: input.movieId } });
    if (!movie || movie.deletedAt) {
      throw new Error('MOVIE_NOT_FOUND: Không tìm thấy phim hoặc phim đã ngừng phát hành.');
    }

    const auditorium = await prisma.auditorium.findUnique({ where: { id: input.auditoriumId } });
    if (!auditorium || !auditorium.isActive) {
      throw new Error('AUDITORIUM_INACTIVE: Phòng chiếu không tồn tại hoặc đang bảo trì.');
    }

    const bufferMins = input.cleaningBufferMinutes ?? Number(process.env.CLEANING_BUFFER_MINUTES || 20);
    const startTime = new Date(input.startTimeIso);
    const totalMinutes = movie.durationMinutes + bufferMins;
    const endTime = new Date(startTime.getTime() + totalMinutes * 60 * 1000);

    // Check overlap with existing non-cancelled showtimes in the same auditorium
    const conflictingShowtime = await prisma.showtime.findFirst({
      where: {
        auditoriumId: input.auditoriumId,
        status: { not: 'CANCELLED' },
        AND: [
          { startTime: { lt: endTime } },
          { endTime: { gt: startTime } }
        ]
      },
      include: { movie: true }
    });

    if (conflictingShowtime) {
      throw new Error(
        `SHOWTIME_CONFLICT: Trùng lịch chiếu tại phòng ${auditorium.name} với phim "${conflictingShowtime.movie.titleVi}" ` +
        `(${conflictingShowtime.startTime.toISOString()} - ${conflictingShowtime.endTime.toISOString()}, đã tính ${bufferMins} phút vệ sinh phòng).`
      );
    }

    const created = await prisma.showtime.create({
      data: {
        movieId: input.movieId,
        auditoriumId: input.auditoriumId,
        showDate: new Date(input.showDate),
        startTime,
        endTime,
        format: input.format,
        basePrice: input.basePrice,
        status: 'OPEN_FOR_SALE'
      }
    });

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'CREATE_SHOWTIME',
        entityType: 'SHOWTIME',
        entityId: created.id,
        summary: `Tạo suất chiếu phim ${movie.titleVi} tại phòng ${auditorium.name} giá cơ bản ${input.basePrice} VNĐ`
      }
    });

    return created;
  }
}
