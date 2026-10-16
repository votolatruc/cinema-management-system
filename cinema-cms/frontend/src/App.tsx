import React, { useState, useEffect, useMemo } from 'react';
import {
  Film,
  Building2,
  Calendar,
  Ticket,
  Users,
  Tag,
  BarChart3,
  ShieldAlert,
  Search,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  Printer,
  Download,
  RefreshCw,
  UserCheck,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Armchair,
  TrendingUp,
  DollarSign,
  Percent,
  LayoutDashboard,
  Compass,
  User,
  Check,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';

// ============================================================================
// 1. TYPES & DOMAIN SCHEMAS (RBAC, ENTITIES, DATABASE STATE)
// ============================================================================

type RoleCode = 'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER';
type MovieStatus = 'NOW_SHOWING' | 'COMING_SOON' | 'ENDED';
type AgeRating = 'P' | 'K' | 'T13' | 'T16' | 'T18';
type SeatCategory = 'STANDARD' | 'VIP' | 'COUPLE' | 'DISABLED';
type ShowtimeStatus = 'OPEN_FOR_SALE' | 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
type BookingStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';
type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY';

interface Cinema {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  openingHours: string;
  isActive: boolean;
}

interface SeatConfig {
  seatCode: string;
  rowLabel: string;
  colNumber: number;
  category: SeatCategory;
  isActive: boolean;
}

interface Auditorium {
  id: string;
  cinemaId: string;
  code: string;
  name: string;
  type: '2D Standard' | '3D Dolby' | 'IMAX Laser' | 'Gold Class';
  rowCount: number;
  colCount: number;
  capacity: number;
  isActive: boolean;
  seats: SeatConfig[];
}

interface Movie {
  id: string;
  code: string;
  titleVi: string;
  titleOriginal: string;
  synopsis: string;
  posterUrl: string;
  bannerUrl?: string;
  trailerUrl: string;
  genres: string[];
  director: string;
  cast: string;
  durationMinutes: number;
  language: string;
  formats: string[];
  ageRating: AgeRating;
  releaseDate: string;
  endDate: string;
  status: MovieStatus;
}

interface Showtime {
  id: string;
  movieId: string;
  cinemaId: string;
  auditoriumId: string;
  showDate: string;
  startTime: string;
  endTime: string;
  format: string;
  basePrice: number;
  status: ShowtimeStatus;
}

interface SeatHold {
  id: string;
  showtimeId: string;
  seatCode: string;
  holderSession: string;
  holderName: string;
  expiresAt: number;
}

interface TicketItem {
  ticketCode: string;
  seatCode: string;
  category: SeatCategory;
  unitPrice: number;
  qrPayload: string;
  isCheckedIn: boolean;
}

interface Booking {
  id: string;
  bookingCode: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  showtimeId: string;
  cinemaId: string;
  auditoriumId: string;
  movieId: string;
  seats: TicketItem[];
  subtotalAmount: number;
  discountAmount: number;
  finalAmount: number;
  promoCode?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: BookingStatus;
  transactionRef: string;
  idempotencyKey: string;
  staffName?: string;
  createdAt: string;
  refundReason?: string;
  refundedAt?: string;
}

interface Customer {
  id: string;
  code: string;
  fullName: string;
  email: string;
  phone: string;
  registeredAt: string;
  loyaltyPoints: number;
  totalTickets: number;
  totalSpent: number;
  tier: 'MEMBER' | 'SILVER' | 'GOLD' | 'DIAMOND';
  status: 'ACTIVE' | 'LOCKED';
}

interface Employee {
  id: string;
  code: string;
  fullName: string;
  email: string;
  phone: string;
  position: string;
  role: RoleCode;
  cinemaId: string;
  status: 'ACTIVE' | 'LOCKED';
  passwordHash: string;
}

interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxDiscountAmount: number;
  minOrderAmount: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  usedCount: number;
  perCustomerLimit: number;
  applicableMovieId?: string;
  isActive: boolean;
}

interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: RoleCode;
  action: string;
  target: string;
  details: string;
}

// ============================================================================
// 2. HELPER UTILITIES (CURRENCY VND, TIMEZONE ASIA/HO_CHI_MINH, SEAT GENERATOR)
// ============================================================================

const formatVND = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(Math.round(amount));
};

const formatDateTimeVN = (isoOrDate: string): string => {
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return isoOrDate;
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return isoOrDate;
  }
};

const addMinutesToTime = (startTimeHHMM: string, durationMinutes: number): string => {
  const [hh, mm] = startTimeHHMM.split(':').map(Number);
  const totalMins = hh * 60 + mm + durationMinutes;
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

const timeToMinutes = (hhmm: string): number => {
  const [hh, mm] = hhmm.split(':').map(Number);
  return hh * 60 + mm;
};

const generateDefaultSeatGrid = (rows: number, cols: number): SeatConfig[] => {
  const rowLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const seats: SeatConfig[] = [];
  for (let r = 0; r < rows; r++) {
    const rowLabel = rowLetters[r] || `R${r + 1}`;
    for (let c = 1; c <= cols; c++) {
      let category: SeatCategory = 'STANDARD';
      if (r === rows - 1) {
        category = 'COUPLE';
      } else if (r >= Math.floor(rows * 0.35) && r <= rows - 2 && c >= 2 && c <= cols - 1) {
        category = 'VIP';
      }
      seats.push({
        seatCode: `${rowLabel}${c}`,
        rowLabel,
        colNumber: c,
        category,
        isActive: true
      });
    }
  }
  return seats;
};

const getSeatUnitPrice = (basePrice: number, category: SeatCategory): number => {
  switch (category) {
    case 'STANDARD':
      return basePrice;
    case 'VIP':
      return basePrice + 25000;
    case 'COUPLE':
      return basePrice * 2 + 30000;
    case 'DISABLED':
      return 0;
  }
};

// ============================================================================
// 3. SEED DATA (2 CINEMAS, 4 AUDITORIUMS, 10 MOVIES, SHOWTIMES, BOOKINGS, PROMOS)
// ============================================================================

const HERO_BANNER_IMG = "user_uploaded_files/ttl=63d/tool_generated/watermarked_img_13077797427459825343.jpg";
const POSTER_SCIFI_IMG = "user_uploaded_files/ttl=63d/tool_generated/watermarked_img_5286706012372143113.jpg";
const POSTER_NOIR_IMG = "user_uploaded_files/ttl=63d/tool_generated/watermarked_img_13947686845114443961.jpg";

const INITIAL_CINEMAS: Cinema[] = [
  {
    id: 'cin-sg-01',
    code: 'CMS-SGN-01',
    name: 'CMS Flagship Sài Gòn Center',
    address: '65 Lê Lợi, Phường Bến Nghé, Quận 1',
    city: 'TP. Hồ Chí Minh',
    phone: '028 3822 8899',
    email: 'saigoncenter@cinemacms.vn',
    openingHours: '08:00 - 23:59',
    isActive: true
  },
  {
    id: 'cin-dn-02',
    code: 'CMS-DAD-02',
    name: 'CMS Sông Hàn Riverside Đà Nẵng',
    address: '74 Bạch Đằng, Quận Hải Châu',
    city: 'Đà Nẵng',
    phone: '0236 3655 779',
    email: 'danang@cinemacms.vn',
    openingHours: '08:30 - 23:30',
    isActive: true
  }
];

const INITIAL_AUDITORIUMS: Auditorium[] = [
  {
    id: 'aud-sg-imax',
    cinemaId: 'cin-sg-01',
    code: 'AUD-SG-01',
    name: 'Phòng 01 - IMAX Laser',
    type: 'IMAX Laser',
    rowCount: 7,
    colCount: 10,
    capacity: 70,
    isActive: true,
    seats: generateDefaultSeatGrid(7, 10)
  },
  {
    id: 'aud-sg-dolby',
    cinemaId: 'cin-sg-01',
    code: 'AUD-SG-02',
    name: 'Phòng 02 - 3D Dolby Atmos',
    type: '3D Dolby',
    rowCount: 6,
    colCount: 8,
    capacity: 48,
    isActive: true,
    seats: generateDefaultSeatGrid(6, 8)
  },
  {
    id: 'aud-dn-gold',
    cinemaId: 'cin-dn-02',
    code: 'AUD-DN-01',
    name: 'Phòng 01 - Gold Class Lounge',
    type: 'Gold Class',
    rowCount: 5,
    colCount: 8,
    capacity: 40,
    isActive: true,
    seats: generateDefaultSeatGrid(5, 8)
  },
  {
    id: 'aud-dn-std',
    cinemaId: 'cin-dn-02',
    code: 'AUD-DN-02',
    name: 'Phòng 02 - 2D Tiêu Chuẩn',
    type: '2D Standard',
    rowCount: 6,
    colCount: 8,
    capacity: 48,
    isActive: true,
    seats: generateDefaultSeatGrid(6, 8)
  }
];

const INITIAL_MOVIES: Movie[] = [
  {
    id: 'mov-01',
    code: 'MV-2026-001',
    titleVi: 'Chân Trời Sự Kiện: Kỷ Nguyên Đỏ',
    titleOriginal: 'Event Horizon: Crimson Era',
    synopsis: 'Năm 2184, phi hành đoàn tàu Thần Nông phát hiện một cổng không-thời gian dị thường gần sao Hỏa. Khi tín hiệu từ Trái Đất đột ngột biến mất, chỉ huy Lâm Vũ phải đưa ra quyết định sinh tử để giải cứu nền văn minh nhân loại.',
    posterUrl: POSTER_SCIFI_IMG,
    bannerUrl: HERO_BANNER_IMG,
    trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    genres: ['Khoa học viễn tưởng', 'Hành động', 'Phiêu lưu'],
    director: 'Denis Trần',
    cast: 'Lâm Vũ, Minh Tuyết, Marcus Vance, Hoàng Bách',
    durationMinutes: 138,
    language: 'Tiếng Anh - Phụ đề Tiếng Việt',
    formats: ['IMAX Laser', '3D Dolby', '2D Standard'],
    ageRating: 'T13',
    releaseDate: '2026-10-01',
    endDate: '2026-11-30',
    status: 'NOW_SHOWING'
  },
  {
    id: 'mov-02',
    code: 'MV-2026-002',
    titleVi: 'Bóng Đêm Sài Gòn: Hồ Sơ Mật',
    titleOriginal: 'Saigon Noir: Classified',
    synopsis: 'Trong những cơn mưa tầm tã giữa lòng Sài Gòn hoa lệ, thanh tra Kiên lần theo dấu vết của một vụ án mạng bí ẩn liên quan đến bức tranh cổ trị giá hàng triệu đô và một tổ chức ngầm thao túng giới tài chính.',
    posterUrl: POSTER_NOIR_IMG,
    bannerUrl: HERO_BANNER_IMG,
    trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    genres: ['Hình sự', 'Tâm lý', 'Bí ẩn'],
    director: 'Victor Vũ Nguyễn',
    cast: 'Trần Nghĩa, Khánh Vân, Quốc Trường, NSƯT Hữu Châu',
    durationMinutes: 122,
    language: 'Tiếng Việt - Phụ đề Anh',
    formats: ['2D Standard', 'Gold Class'],
    ageRating: 'T16',
    releaseDate: '2026-10-05',
    endDate: '2026-11-20',
    status: 'NOW_SHOWING'
  },
  {
    id: 'mov-03',
    code: 'MV-2026-003',
    titleVi: 'Hành Tinh Cát: Bình Minh Hai Mặt Trời',
    titleOriginal: 'Twin Suns of Solaria',
    synopsis: 'Cuộc chiến giành nguồn khoáng sản năng lượng quý hiếm trên hành tinh sa mạc Solaria giữa liên minh định cư và tập đoàn khai khoáng liên sao.',
    posterUrl: HERO_BANNER_IMG,
    trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    genres: ['Khoa học viễn tưởng', 'Hành động'],
    director: 'Christopher Lê',
    cast: 'Kaito Sato, Elena Rostova, Tuấn Nguyễn',
    durationMinutes: 145,
    language: 'Tiếng Anh - Phụ đề Tiếng Việt',
    formats: ['IMAX Laser', '3D Dolby'],
    ageRating: 'T13',
    releaseDate: '2026-10-10',
    endDate: '2026-12-01',
    status: 'NOW_SHOWING'
  },
  {
    id: 'mov-04',
    code: 'MV-2026-004',
    titleVi: 'Mùa Thu Hà Nội Nhớ Em',
    titleOriginal: 'Autumn Breeze in Hanoi',
    synopsis: 'Chuyện tình lãng mạn và đầy hoài niệm giữa một nhạc sĩ dương cầm trẻ và cô họa sĩ phục chế tranh cổ bên hồ Gươm qua bốn mùa chuyển giao.',
    posterUrl: POSTER_NOIR_IMG,
    trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    genres: ['Lãng mạn', 'Tâm lý'],
    director: 'Đặng Thái Huyền',
    cast: 'Phương Anh Đào, Thanh Sơn, NSND Lê Khanh',
    durationMinutes: 112,
    language: 'Tiếng Việt',
    formats: ['2D Standard', 'Gold Class'],
    ageRating: 'P',
    releaseDate: '2026-10-08',
    endDate: '2026-11-15',
    status: 'NOW_SHOWING'
  },
  {
    id: 'mov-05',
    code: 'MV-2026-005',
    titleVi: 'Vương Quốc Rồng Nhí: Giải Cứu Đảo Mây',
    titleOriginal: 'Little Dragon Kingdom',
    synopsis: 'Chú rồng nhỏ Poco cùng những người bạn bước vào chuyến phiêu lưu kỳ thú vượt qua đại dương mây để khôi phục viên ngọc ánh sáng cho vương quốc.',
    posterUrl: POSTER_SCIFI_IMG,
    trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    genres: ['Hoạt hình', 'Gia đình', 'Phiêu lưu'],
    director: 'Miyazaki Kenji',
    cast: 'Lồng tiếng Việt: Minh Tiệp, Bảo Ngọc',
    durationMinutes: 98,
    language: 'Lồng tiếng Việt',
    formats: ['2D Standard', '3D Dolby'],
    ageRating: 'K',
    releaseDate: '2026-10-12',
    endDate: '2026-11-30',
    status: 'NOW_SHOWING'
  },
  {
    id: 'mov-06',
    code: 'MV-2026-006',
    titleVi: 'Điệu Valse Đêm Trăng Máu',
    titleOriginal: 'Blood Moon Waltz',
    synopsis: 'Một buổi hòa nhạc giao hưởng tại dinh thự cổ trên đồi Đà Lạt biến thành trò chơi sinh tồn khi cánh cửa dinh thự khóa chặt lúc nửa đêm.',
    posterUrl: POSTER_NOIR_IMG,
    trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    genres: ['Kinh dị', 'Bí ẩn'],
    director: 'Trần Hữu Tấn',
    cast: 'Rima Thanh Vy, Hoàng Hà, Quốc Huy',
    durationMinutes: 118,
    language: 'Tiếng Việt',
    formats: ['2D Standard'],
    ageRating: 'T18',
    releaseDate: '2026-10-14',
    endDate: '2026-11-25',
    status: 'NOW_SHOWING'
  },
  {
    id: 'mov-07',
    code: 'MV-2026-007',
    titleVi: 'Phi Vụ Thế Kỷ: Hầm Ngầm Zurich',
    titleOriginal: 'The Zurich Vault Heist',
    synopsis: 'Một nhóm chuyên gia bảo mật quốc tế lên kế hoạch đột nhập vào kho lưu trữ lượng tử an toàn nhất thế giới tại Thụy Sĩ.',
    posterUrl: POSTER_SCIFI_IMG,
    trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    genres: ['Hành động', 'Hình sự'],
    director: 'Guy Ritchie',
    cast: 'Jason Statham, Henry Golding, Ngô Thanh Vân',
    durationMinutes: 126,
    language: 'Tiếng Anh - Phụ đề Tiếng Việt',
    formats: ['2D Standard', 'IMAX Laser'],
    ageRating: 'T16',
    releaseDate: '2026-10-25',
    endDate: '2026-12-15',
    status: 'COMING_SOON'
  },
  {
    id: 'mov-08',
    code: 'MV-2026-008',
    titleVi: 'Huyền Thoại Cổ Loa Thành',
    titleOriginal: 'Legend of Co Loa Citadel',
    synopsis: 'Tác phẩm sử thi tái hiện hào khí xây thành Cổ Loa và bí mật chiếc nỏ thần Kim Quy trong lịch sử cổ đại Việt Nam.',
    posterUrl: HERO_BANNER_IMG,
    trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    genres: ['Lịch sử', 'Hành động', 'Phiêu lưu'],
    director: 'Charlie Nguyễn',
    cast: 'Johnny Trí Nguyễn, Đỗ Thị Hải Yến, Liên Bỉnh Phát',
    durationMinutes: 142,
    language: 'Tiếng Việt - Phụ đề Anh',
    formats: ['IMAX Laser', '2D Standard'],
    ageRating: 'T13',
    releaseDate: '2026-11-05',
    endDate: '2026-12-30',
    status: 'COMING_SOON'
  },
  {
    id: 'mov-09',
    code: 'MV-2026-009',
    titleVi: 'Bản Giao Hưởng Trí Tuệ Nhân Tạo',
    titleOriginal: 'Synthetic Symphony',
    synopsis: 'Khi một hệ thống AI sáng tác âm nhạc bắt đầu có ý thức và đòi quyền tác giả trước tòa án quốc tế.',
    posterUrl: POSTER_SCIFI_IMG,
    trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    genres: ['Khoa học viễn tưởng', 'Tâm lý'],
    director: 'Alex Garland',
    cast: 'Oscar Isaac, Sonoya Mizuno',
    durationMinutes: 115,
    language: 'Tiếng Anh - Phụ đề Tiếng Việt',
    formats: ['2D Standard', 'Gold Class'],
    ageRating: 'T13',
    releaseDate: '2026-11-12',
    endDate: '2026-12-20',
    status: 'COMING_SOON'
  },
  {
    id: 'mov-10',
    code: 'MV-2026-010',
    titleVi: 'Chuyến Tàu Đêm Miền Trung',
    titleOriginal: 'Midnight Express Across Central',
    synopsis: 'Hành trình đầy ắp tiếng cười và nước mắt của những hành khách xa lạ trên chuyến tàu thống nhất xuyên qua đèo Hải Vân.',
    posterUrl: POSTER_NOIR_IMG,
    trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    genres: ['Gia đình', 'Hài', 'Tâm lý'],
    director: 'Vũ Ngọc Đãng',
    cast: 'Thái Hòa, Thu Trang, Kiều Minh Tuấn',
    durationMinutes: 108,
    language: 'Tiếng Việt',
    formats: ['2D Standard'],
    ageRating: 'P',
    releaseDate: '2026-08-15',
    endDate: '2026-10-01',
    status: 'ENDED'
  }
];

const INITIAL_SHOWTIMES: Showtime[] = [
  {
    id: 'st-01',
    movieId: 'mov-01',
    cinemaId: 'cin-sg-01',
    auditoriumId: 'aud-sg-imax',
    showDate: '2026-10-16',
    startTime: '14:00',
    endTime: '16:38',
    format: 'IMAX Laser',
    basePrice: 120000,
    status: 'OPEN_FOR_SALE'
  },
  {
    id: 'st-02',
    movieId: 'mov-01',
    cinemaId: 'cin-sg-01',
    auditoriumId: 'aud-sg-imax',
    showDate: '2026-10-16',
    startTime: '18:30',
    endTime: '21:08',
    format: 'IMAX Laser',
    basePrice: 135000,
    status: 'OPEN_FOR_SALE'
  },
  {
    id: 'st-03',
    movieId: 'mov-02',
    cinemaId: 'cin-sg-01',
    auditoriumId: 'aud-sg-dolby',
    showDate: '2026-10-16',
    startTime: '15:30',
    endTime: '17:52',
    format: '3D Dolby',
    basePrice: 95000,
    status: 'OPEN_FOR_SALE'
  },
  {
    id: 'st-04',
    movieId: 'mov-02',
    cinemaId: 'cin-sg-01',
    auditoriumId: 'aud-sg-dolby',
    showDate: '2026-10-16',
    startTime: '19:30',
    endTime: '21:52',
    format: '3D Dolby',
    basePrice: 105000,
    status: 'OPEN_FOR_SALE'
  },
  {
    id: 'st-05',
    movieId: 'mov-03',
    cinemaId: 'cin-dn-02',
    auditoriumId: 'aud-dn-gold',
    showDate: '2026-10-16',
    startTime: '17:00',
    endTime: '19:45',
    format: 'Gold Class',
    basePrice: 150000,
    status: 'OPEN_FOR_SALE'
  },
  {
    id: 'st-06',
    movieId: 'mov-05',
    cinemaId: 'cin-dn-02',
    auditoriumId: 'aud-dn-std',
    showDate: '2026-10-16',
    startTime: '16:00',
    endTime: '17:58',
    format: '2D Standard',
    basePrice: 75000,
    status: 'OPEN_FOR_SALE'
  },
  {
    id: 'st-07',
    movieId: 'mov-01',
    cinemaId: 'cin-sg-01',
    auditoriumId: 'aud-sg-imax',
    showDate: '2026-10-17',
    startTime: '19:00',
    endTime: '21:38',
    format: 'IMAX Laser',
    basePrice: 135000,
    status: 'OPEN_FOR_SALE'
  },
  {
    id: 'st-08',
    movieId: 'mov-06',
    cinemaId: 'cin-sg-01',
    auditoriumId: 'aud-sg-dolby',
    showDate: '2026-10-17',
    startTime: '21:30',
    endTime: '23:48',
    format: '2D Standard',
    basePrice: 95000,
    status: 'OPEN_FOR_SALE'
  }
];

const INITIAL_PROMOTIONS: Promotion[] = [
  {
    id: 'prm-01',
    code: 'CMSWELCOME20',
    name: 'Ưu Đãi Thành Viên Mới Giảm 20%',
    description: 'Giảm 20% tối đa 60.000 VNĐ cho đơn đặt vé từ 150.000 VNĐ trở lên.',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxDiscountAmount: 60000,
    minOrderAmount: 150000,
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    usageLimit: 500,
    usedCount: 42,
    perCustomerLimit: 2,
    isActive: true
  },
  {
    id: 'prm-02',
    code: 'IMAX50K',
    name: 'Trải Nghiệm IMAX Giảm Ngay 50.000đ',
    description: 'Giảm trực tiếp 50.000 VNĐ cho hóa đơn từ 250.000 VNĐ.',
    discountType: 'FIXED_AMOUNT',
    discountValue: 50000,
    maxDiscountAmount: 50000,
    minOrderAmount: 250000,
    startDate: '2026-10-01',
    endDate: '2026-11-30',
    usageLimit: 200,
    usedCount: 19,
    perCustomerLimit: 1,
    isActive: true
  },
  {
    id: 'prm-03',
    code: 'EXPIRED2025',
    name: 'Mã Khuyến Mãi Hết Hạn (Test Validation)',
    description: 'Chương trình đã kết thúc dùng để kiểm thử chặn mã hết hạn.',
    discountType: 'FIXED_AMOUNT',
    discountValue: 30000,
    maxDiscountAmount: 30000,
    minOrderAmount: 100000,
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    usageLimit: 100,
    usedCount: 100,
    perCustomerLimit: 1,
    isActive: false
  }
];

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cus-01',
    code: 'KH-1001',
    fullName: 'Phạm Quốc Khách Hàng',
    email: 'khachhang@gmail.com',
    phone: '0909123456',
    registeredAt: '2026-01-15',
    loyaltyPoints: 480,
    totalTickets: 8,
    totalSpent: 1120000,
    tier: 'GOLD',
    status: 'ACTIVE'
  },
  {
    id: 'cus-02',
    code: 'KH-1002',
    fullName: 'Nguyễn Thị Mai Anh',
    email: 'maianh.nguyen@gmail.com',
    phone: '0912345678',
    registeredAt: '2026-03-20',
    loyaltyPoints: 950,
    totalTickets: 16,
    totalSpent: 2450000,
    tier: 'DIAMOND',
    status: 'ACTIVE'
  },
  {
    id: 'cus-03',
    code: 'KH-1003',
    fullName: 'Đỗ Hoàng Nam',
    email: 'hoangnam.do@outlook.com',
    phone: '0987654321',
    registeredAt: '2026-06-10',
    loyaltyPoints: 150,
    totalTickets: 3,
    totalSpent: 360000,
    tier: 'SILVER',
    status: 'ACTIVE'
  },
  {
    id: 'cus-04',
    code: 'KH-1004',
    fullName: 'Võ Minh Khôi',
    email: 'minhkhoi.vo@gmail.com',
    phone: '0933445566',
    registeredAt: '2026-09-02',
    loyaltyPoints: 50,
    totalTickets: 1,
    totalSpent: 120000,
    tier: 'MEMBER',
    status: 'LOCKED'
  }
];

const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-01',
    code: 'NV-ADMIN-01',
    fullName: 'Nguyễn Hoàng Quản Trị',
    email: 'admin@cinemacms.vn',
    phone: '0901000111',
    position: 'Giám đốc Công nghệ & Hệ thống',
    role: 'ADMIN',
    cinemaId: 'cin-sg-01',
    status: 'ACTIVE',
    passwordHash: '$2b$12$eImiTXuWVxfM37uY4JANjQ.HashAdmin2026'
  },
  {
    id: 'emp-02',
    code: 'NV-MGR-02',
    fullName: 'Trần Minh Quản Lý',
    email: 'manager.sg@cinemacms.vn',
    phone: '0902000222',
    position: 'Quản lý Cụm Rạp Sài Gòn',
    role: 'MANAGER',
    cinemaId: 'cin-sg-01',
    status: 'ACTIVE',
    passwordHash: '$2b$12$eImiTXuWVxfM37uY4JANjQ.HashMgr2026'
  },
  {
    id: 'emp-03',
    code: 'NV-STF-03',
    fullName: 'Lê Thu Nhân Viên',
    email: 'staff.sg@cinemacms.vn',
    phone: '0903000333',
    position: 'Chuyên viên Bán vé & Soát vé POS',
    role: 'STAFF',
    cinemaId: 'cin-sg-01',
    status: 'ACTIVE',
    passwordHash: '$2b$12$eImiTXuWVxfM37uY4JANjQ.HashStaff2026'
  },
  {
    id: 'emp-04',
    code: 'NV-MGR-04',
    fullName: 'Phan Thanh Hải',
    email: 'manager.dn@cinemacms.vn',
    phone: '0904000444',
    position: 'Quản lý Cụm Rạp Đà Nẵng',
    role: 'MANAGER',
    cinemaId: 'cin-dn-02',
    status: 'ACTIVE',
    passwordHash: '$2b$12$eImiTXuWVxfM37uY4JANjQ.HashMgrDN2026'
  }
];

const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'bk-101',
    bookingCode: 'ORD-261016-8801',
    customerId: 'cus-01',
    customerName: 'Phạm Quốc Khách Hàng',
    customerPhone: '0909123456',
    customerEmail: 'khachhang@gmail.com',
    showtimeId: 'st-01',
    cinemaId: 'cin-sg-01',
    auditoriumId: 'aud-sg-imax',
    movieId: 'mov-01',
    seats: [
      {
        ticketCode: 'TKT-8801-D5',
        seatCode: 'D5',
        category: 'VIP',
        unitPrice: 145000,
        qrPayload: 'CMS|ORD-261016-8801|TKT-8801-D5|ST-01|D5',
        isCheckedIn: true
      },
      {
        ticketCode: 'TKT-8801-D6',
        seatCode: 'D6',
        category: 'VIP',
        unitPrice: 145000,
        qrPayload: 'CMS|ORD-261016-8801|TKT-8801-D6|ST-01|D6',
        isCheckedIn: true
      }
    ],
    subtotalAmount: 290000,
    discountAmount: 50000,
    finalAmount: 240000,
    promoCode: 'IMAX50K',
    paymentMethod: 'ONLINE_GATEWAY',
    paymentStatus: 'PAID',
    transactionRef: 'VNPAY-20261016-99102',
    idempotencyKey: 'IDEMP-8801',
    createdAt: '2026-10-16T08:30:00+07:00'
  },
  {
    id: 'bk-102',
    bookingCode: 'ORD-261016-8802',
    customerId: 'cus-02',
    customerName: 'Nguyễn Thị Mai Anh',
    customerPhone: '0912345678',
    customerEmail: 'maianh.nguyen@gmail.com',
    showtimeId: 'st-02',
    cinemaId: 'cin-sg-01',
    auditoriumId: 'aud-sg-imax',
    movieId: 'mov-01',
    seats: [
      {
        ticketCode: 'TKT-8802-E5',
        seatCode: 'E5',
        category: 'VIP',
        unitPrice: 160000,
        qrPayload: 'CMS|ORD-261016-8802|TKT-8802-E5|ST-02|E5',
        isCheckedIn: false
      },
      {
        ticketCode: 'TKT-8802-E6',
        seatCode: 'E6',
        category: 'VIP',
        unitPrice: 160000,
        qrPayload: 'CMS|ORD-261016-8802|TKT-8802-E6|ST-02|E6',
        isCheckedIn: false
      },
      {
        ticketCode: 'TKT-8802-G5',
        seatCode: 'G5',
        category: 'COUPLE',
        unitPrice: 300000,
        qrPayload: 'CMS|ORD-261016-8802|TKT-8802-G5|ST-02|G5',
        isCheckedIn: false
      }
    ],
    subtotalAmount: 620000,
    discountAmount: 60000,
    finalAmount: 560000,
    promoCode: 'CMSWELCOME20',
    paymentMethod: 'BANK_TRANSFER',
    paymentStatus: 'PAID',
    transactionRef: 'VIETQR-20261016-77319',
    idempotencyKey: 'IDEMP-8802',
    staffName: 'Lê Thu Nhân Viên',
    createdAt: '2026-10-16T09:15:00+07:00'
  },
  {
    id: 'bk-103',
    bookingCode: 'ORD-261016-8803',
    customerId: 'cus-03',
    customerName: 'Đỗ Hoàng Nam',
    customerPhone: '0987654321',
    customerEmail: 'hoangnam.do@outlook.com',
    showtimeId: 'st-03',
    cinemaId: 'cin-sg-01',
    auditoriumId: 'aud-sg-dolby',
    movieId: 'mov-02',
    seats: [
      {
        ticketCode: 'TKT-8803-C4',
        seatCode: 'C4',
        category: 'VIP',
        unitPrice: 120000,
        qrPayload: 'CMS|ORD-261016-8803|TKT-8803-C4|ST-03|C4',
        isCheckedIn: false
      },
      {
        ticketCode: 'TKT-8803-C5',
        seatCode: 'C5',
        category: 'VIP',
        unitPrice: 120000,
        qrPayload: 'CMS|ORD-261016-8803|TKT-8803-C5|ST-03|C5',
        isCheckedIn: false
      }
    ],
    subtotalAmount: 240000,
    discountAmount: 0,
    finalAmount: 240000,
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
    transactionRef: 'POS-CASH-8803',
    idempotencyKey: 'IDEMP-8803',
    staffName: 'Lê Thu Nhân Viên',
    createdAt: '2026-10-15T19:20:00+07:00'
  },
  {
    id: 'bk-104',
    bookingCode: 'ORD-261016-8804',
    customerId: 'cus-01',
    customerName: 'Phạm Quốc Khách Hàng',
    customerPhone: '0909123456',
    customerEmail: 'khachhang@gmail.com',
    showtimeId: 'st-05',
    cinemaId: 'cin-dn-02',
    auditoriumId: 'aud-dn-gold',
    movieId: 'mov-03',
    seats: [
      {
        ticketCode: 'TKT-8804-B3',
        seatCode: 'B3',
        category: 'VIP',
        unitPrice: 175000,
        qrPayload: 'CMS|ORD-261016-8804|TKT-8804-B3|ST-05|B3',
        isCheckedIn: false
      }
    ],
    subtotalAmount: 175000,
    discountAmount: 0,
    finalAmount: 175000,
    paymentMethod: 'ONLINE_GATEWAY',
    paymentStatus: 'REFUNDED',
    transactionRef: 'VNPAY-20261014-55122',
    idempotencyKey: 'IDEMP-8804',
    createdAt: '2026-10-14T15:10:00+07:00',
    refundReason: 'Khách hàng thay đổi lịch công tác trước giờ chiếu 24h',
    refundedAt: '2026-10-15T10:00:00+07:00'
  },
  {
    id: 'bk-105',
    bookingCode: 'ORD-261016-8805',
    customerName: 'Khách Vãng Lai Quầy POS',
    customerPhone: '0977889900',
    customerEmail: 'guest@cinemacms.vn',
    showtimeId: 'st-06',
    cinemaId: 'cin-dn-02',
    auditoriumId: 'aud-dn-std',
    movieId: 'mov-05',
    seats: [
      {
        ticketCode: 'TKT-8805-A3',
        seatCode: 'A3',
        category: 'STANDARD',
        unitPrice: 75000,
        qrPayload: 'CMS|ORD-261016-8805|TKT-8805-A3|ST-06|A3',
        isCheckedIn: false
      },
      {
        ticketCode: 'TKT-8805-A4',
        seatCode: 'A4',
        category: 'STANDARD',
        unitPrice: 75000,
        qrPayload: 'CMS|ORD-261016-8805|TKT-8805-A4|ST-06|A4',
        isCheckedIn: false
      }
    ],
    subtotalAmount: 150000,
    discountAmount: 0,
    finalAmount: 150000,
    paymentMethod: 'BANK_TRANSFER',
    paymentStatus: 'PENDING',
    transactionRef: 'PENDING-VIETQR-8805',
    idempotencyKey: 'IDEMP-8805',
    createdAt: '2026-10-16T10:15:00+07:00'
  }
];

const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-01',
    timestamp: '2026-10-16T10:15:00+07:00',
    actorName: 'Lê Thu Nhân Viên',
    actorRole: 'STAFF',
    action: 'CREATE_BOOKING',
    target: 'ORD-261016-8805',
    details: 'Tạo đơn đặt vé tại quầy POS (Chờ thanh toán 150.000 VNĐ) - Suất ST-06'
  },
  {
    id: 'log-02',
    timestamp: '2026-10-16T09:15:12+07:00',
    actorName: 'Lê Thu Nhân Viên',
    actorRole: 'STAFF',
    action: 'CONFIRM_PAYMENT',
    target: 'ORD-261016-8802',
    details: 'Xác nhận thanh toán VietQR 560.000 VNĐ (Đã áp mã CMSWELCOME20)'
  },
  {
    id: 'log-03',
    timestamp: '2026-10-15T10:00:00+07:00',
    actorName: 'Trần Minh Quản Lý',
    actorRole: 'MANAGER',
    action: 'REFUND_BOOKING',
    target: 'ORD-261016-8804',
    details: 'Hoàn tiền 175.000 VNĐ và giải phóng ghế B3 cho suất chiếu ST-05'
  },
  {
    id: 'log-04',
    timestamp: '2026-10-14T08:00:00+07:00',
    actorName: 'Nguyễn Hoàng Quản Trị',
    actorRole: 'ADMIN',
    action: 'SYSTEM_CONFIG',
    target: 'CLEANING_BUFFER_MINUTES',
    details: 'Cấu hình thời gian nghỉ & vệ sinh phòng chiếu giữa 2 suất: 20 phút'
  }
];

const ROLE_PERMISSIONS: Record<RoleCode, string[]> = {
  ADMIN: [
    'dashboard:view',
    'movies:read', 'movies:write', 'movies:delete',
    'cinemas:read', 'cinemas:write',
    'auditoriums:read', 'auditoriums:write',
    'showtimes:read', 'showtimes:write',
    'pos:use',
    'bookings:read', 'bookings:manage', 'bookings:refund',
    'customers:read', 'customers:write',
    'promotions:read', 'promotions:write',
    'employees:read', 'employees:write',
    'reports:view',
    'audit:view',
    'customer_portal:use'
  ],
  MANAGER: [
    'dashboard:view',
    'movies:read', 'movies:write',
    'cinemas:read',
    'auditoriums:read', 'auditoriums:write',
    'showtimes:read', 'showtimes:write',
    'pos:use',
    'bookings:read', 'bookings:manage', 'bookings:refund',
    'customers:read', 'customers:write',
    'promotions:read', 'promotions:write',
    'employees:read',
    'reports:view',
    'customer_portal:use'
  ],
  STAFF: [
    'movies:read',
    'showtimes:read',
    'pos:use',
    'bookings:read', 'bookings:manage',
    'customers:read',
    'customer_portal:use'
  ],
  CUSTOMER: [
    'customer_portal:use'
  ]
};

export default function App() {
  const [currentRole, setCurrentRole] = useState<RoleCode>('ADMIN');
  const [portalMode, setPortalMode] = useState<'ADMIN_CMS' | 'CUSTOMER_WEB'>('ADMIN_CMS');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [customerView, setCustomerView] = useState<'HOME' | 'MOVIES' | 'MOVIE_DETAIL' | 'BOOKING_WIZARD' | 'MY_ACCOUNT'>('HOME');

  const [cinemas] = useState<Cinema[]>(INITIAL_CINEMAS);
  const [auditoriums, setAuditoriums] = useState<Auditorium[]>(INITIAL_AUDITORIUMS);
  const [movies, setMovies] = useState<Movie[]>(INITIAL_MOVIES);
  const [showtimes, setShowtimes] = useState<Showtime[]>(INITIAL_SHOWTIMES);
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [promotions, setPromotions] = useState<Promotion[]>(INITIAL_PROMOTIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [cleaningBufferMins, setCleaningBufferMins] = useState<number>(20);
  const [paymentMode] = useState<'DEMO' | 'PRODUCTION_READY'>('DEMO');

  const [seatHolds, setSeatHolds] = useState<SeatHold[]>([
    {
      id: 'hold-ext-1',
      showtimeId: 'st-01',
      seatCode: 'E7',
      holderSession: 'EXTERNAL_USER_SESSION_99',
      holderName: 'Khách hàng trực tuyến #99',
      expiresAt: Date.now() + 240000
    },
    {
      id: 'hold-ext-2',
      showtimeId: 'st-01',
      seatCode: 'E8',
      holderSession: 'EXTERNAL_USER_SESSION_99',
      holderName: 'Khách hàng trực tuyến #99',
      expiresAt: Date.now() + 240000
    }
  ]);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; title: string; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const [activeTicketModal, setActiveTicketModal] = useState<Booking | null>(null);

  const [selectedShowtimeId, setSelectedShowtimeId] = useState<string>('st-01');
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [bookingPromoInput, setBookingPromoInput] = useState<string>('');
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [bookingCustomerName, setBookingCustomerName] = useState<string>('Phạm Quốc Khách Hàng');
  const [bookingCustomerPhone, setBookingCustomerPhone] = useState<string>('0909123456');
  const [bookingCustomerEmail, setBookingCustomerEmail] = useState<string>('khachhang@gmail.com');
  const [bookingPaymentMethod, setBookingPaymentMethod] = useState<PaymentMethod>('ONLINE_GATEWAY');
  const [ticketLookupQuery, setTicketLookupQuery] = useState<string>('');

  const [dashboardCinemaFilter, setDashboardCinemaFilter] = useState<string>('ALL');
  const [movieSearch, setMovieSearch] = useState<string>('');
  const [movieGenreFilter] = useState<string>('ALL');
  const [movieStatusFilter, setMovieStatusFilter] = useState<string>('ALL');
  const [movieAgeFilter, setMovieAgeFilter] = useState<string>('ALL');
  const [movieSortBy, setMovieSortBy] = useState<'title' | 'releaseDate' | 'duration'>('releaseDate');
  const [moviePage, setMoviePage] = useState<number>(1);
  const [selectedMovieDetail, setSelectedMovieDetail] = useState<Movie>(INITIAL_MOVIES[0]);

  const [isMovieModalOpen, setIsMovieModalOpen] = useState<boolean>(false);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [movieForm, setMovieForm] = useState<Partial<Movie>>({});

  const [selectedAuditoriumId, setSelectedAuditoriumId] = useState<string>('aud-sg-imax');
  const [seatBrushType, setSeatBrushType] = useState<SeatCategory>('VIP');

  const [showtimeDateFilter, setShowtimeDateFilter] = useState<string>('ALL');
  const [showtimeCinemaFilter, setShowtimeCinemaFilter] = useState<string>('ALL');
  const [isShowtimeModalOpen, setIsShowtimeModalOpen] = useState<boolean>(false);
  const [newShowtimeForm, setNewShowtimeForm] = useState({
    movieId: 'mov-01',
    cinemaId: 'cin-sg-01',
    auditoriumId: 'aud-sg-imax',
    showDate: '2026-10-16',
    startTime: '21:30',
    format: 'IMAX Laser',
    basePrice: 125000
  });

  const [orderSearch, setOrderSearch] = useState<string>('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isPromoModalOpen, setIsPromoModalOpen] = useState<boolean>(false);
  const [newPromoForm, setNewPromoForm] = useState({
    code: '',
    name: '',
    description: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
    discountValue: 15,
    maxDiscountAmount: 50000,
    minOrderAmount: 120000,
    startDate: '2026-10-16',
    endDate: '2026-12-31',
    usageLimit: 100
  });
  const [isStaffModalOpen, setIsStaffModalOpen] = useState<boolean>(false);
  const [newStaffForm, setNewStaffForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    position: 'Chuyên viên Bán vé',
    role: 'STAFF' as RoleCode,
    cinemaId: 'cin-sg-01'
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      setSeatHolds(prev => prev.filter(h => h.expiresAt > now));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const showNotification = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    setToast({ type, title, message });
    setTimeout(() => {
      setToast(prev => (prev?.title === title ? null : prev));
    }, 4500);
  };

  const appendAuditLog = (action: string, target: string, details: string) => {
    const actorMap: Record<RoleCode, string> = {
      ADMIN: 'Nguyễn Hoàng Quản Trị',
      MANAGER: 'Trần Minh Quản Lý',
      STAFF: 'Lê Thu Nhân Viên',
      CUSTOMER: 'Phạm Quốc Khách Hàng'
    };
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: actorMap[currentRole],
      actorRole: currentRole,
      action,
      target,
      details
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const assertPermission = (permission: string): boolean => {
    const allowed = ROLE_PERMISSIONS[currentRole]?.includes(permission);
    if (!allowed) {
      showNotification(
        'error',
        'Từ chối truy cập (403 Forbidden)',
        `API Backend từ chối yêu cầu: Vai trò [${currentRole}] không có quyền "${permission}".`
      );
      appendAuditLog('UNAUTHORIZED_ATTEMPT', permission, `Cố gắng truy cập trái phép chức năng ${permission}`);
      return false;
    }
    return true;
  };

  const handleSwitchRole = (role: RoleCode) => {
    setCurrentRole(role);
    if (role === 'CUSTOMER') {
      setPortalMode('CUSTOMER_WEB');
      setCustomerView('HOME');
    } else {
      setPortalMode('ADMIN_CMS');
      if (role === 'STAFF') {
        setActiveTab('pos');
      } else {
        setActiveTab('dashboard');
      }
    }
    showNotification('info', `Đã chuyển vai trò: ${role}`, `Giao diện và phân quyền API đã cập nhật sang vai trò ${role}.`);
  };

  const analytics = useMemo(() => {
    const filteredBookings = dashboardCinemaFilter === 'ALL'
      ? bookings
      : bookings.filter(b => b.cinemaId === dashboardCinemaFilter);

    const paidBookings = filteredBookings.filter(b => b.paymentStatus === 'PAID');
    const refundedBookings = filteredBookings.filter(b => b.paymentStatus === 'REFUNDED');
    const pendingBookings = filteredBookings.filter(b => b.paymentStatus === 'PENDING');

    const grossPaidRevenue = paidBookings.reduce((sum, b) => sum + b.finalAmount, 0) +
                             refundedBookings.reduce((sum, b) => sum + b.finalAmount, 0);
    const totalRefundedAmount = refundedBookings.reduce((sum, b) => sum + b.finalAmount, 0);
    const netRevenue = paidBookings.reduce((sum, b) => sum + b.finalAmount, 0);
    const pendingRevenue = pendingBookings.reduce((sum, b) => sum + b.finalAmount, 0);

    const totalTicketsSold = paidBookings.reduce((sum, b) => sum + b.seats.length, 0);
    const avgOrderValue = paidBookings.length > 0 ? Math.round(netRevenue / paidBookings.length) : 0;

    const activeShowtimes = showtimes.filter(s =>
      s.status === 'OPEN_FOR_SALE' &&
      (dashboardCinemaFilter === 'ALL' || s.cinemaId === dashboardCinemaFilter)
    );
    const totalAvailableSeatCapacity = activeShowtimes.reduce((sum, st) => {
      const aud = auditoriums.find(a => a.id === st.auditoriumId);
      return sum + (aud ? aud.seats.filter(s => s.category !== 'DISABLED').length : 60);
    }, 0);
    const occupancyRate = totalAvailableSeatCapacity > 0
      ? Number(((totalTicketsSold / totalAvailableSeatCapacity) * 100).toFixed(1))
      : 0;

    const revenueByMovie = movies
      .filter(m => m.status !== 'COMING_SOON')
      .map(m => {
        const moviePaidOrders = paidBookings.filter(b => b.movieId === m.id);
        const rev = moviePaidOrders.reduce((s, b) => s + b.finalAmount, 0);
        const tickets = moviePaidOrders.reduce((s, b) => s + b.seats.length, 0);
        return {
          id: m.id,
          title: m.titleVi.length > 22 ? m.titleVi.slice(0, 22) + '...' : m.titleVi,
          fullTitle: m.titleVi,
          revenue: rev,
          tickets
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const dailySeries = [
      { date: '10/10', revenue: 420000, tickets: 4, refund: 0 },
      { date: '11/10', revenue: 680000, tickets: 6, refund: 0 },
      { date: '12/10', revenue: 510000, tickets: 5, refund: 0 },
      { date: '13/10', revenue: 790000, tickets: 7, refund: 0 },
      { date: '14/10', revenue: 640000, tickets: 6, refund: 175000 },
      { date: '15/10', revenue: 890000, tickets: 8, refund: 0 },
      { date: '16/10 (Hôm nay)', revenue: netRevenue, tickets: totalTicketsSold, refund: totalRefundedAmount }
    ];

    return {
      grossPaidRevenue,
      totalRefundedAmount,
      netRevenue,
      pendingRevenue,
      totalTicketsSold,
      avgOrderValue,
      occupancyRate,
      activeShowtimesCount: activeShowtimes.length,
      nowShowingMoviesCount: movies.filter(m => m.status === 'NOW_SHOWING').length,
      revenueByMovie,
      dailySeries
    };
  }, [bookings, showtimes, auditoriums, movies, dashboardCinemaFilter]);

  const selectedShowtime = useMemo(
    () => showtimes.find(s => s.id === selectedShowtimeId) || showtimes[0],
    [showtimes, selectedShowtimeId]
  );

  const selectedAuditorium = useMemo(
    () => auditoriums.find(a => a.id === selectedShowtime?.auditoriumId) || auditoriums[0],
    [auditoriums, selectedShowtime]
  );

  const selectedMovieForShowtime = useMemo(
    () => movies.find(m => m.id === selectedShowtime?.movieId) || movies[0],
    [movies, selectedShowtime]
  );

  const soldSeatCodesForShowtime = useMemo(() => {
    const codes = new Set<string>();
    bookings
      .filter(b => b.showtimeId === selectedShowtime?.id && (b.paymentStatus === 'PAID' || b.paymentStatus === 'PENDING'))
      .forEach(b => b.seats.forEach(s => codes.add(s.seatCode)));
    return codes;
  }, [bookings, selectedShowtime]);

  const heldByOtherSeatCodes = useMemo(() => {
    const map = new Map<string, SeatHold>();
    seatHolds
      .filter(h => h.showtimeId === selectedShowtime?.id && h.expiresAt > nowTick && h.holderSession !== 'CURRENT_USER')
      .forEach(h => map.set(h.seatCode, h));
    return map;
  }, [seatHolds, selectedShowtime, nowTick]);

  const handleToggleSeat = (seat: SeatConfig) => {
    if (!selectedShowtime || selectedShowtime.status !== 'OPEN_FOR_SALE') {
      showNotification('error', 'Suất chiếu đã đóng', 'Không thể chọn ghế cho suất chiếu đã hủy hoặc ngừng bán.');
      return;
    }
    if (seat.category === 'DISABLED' || !seat.isActive) {
      showNotification('error', 'Ghế đang bảo trì', `Ghế ${seat.seatCode} hiện không sử dụng.`);
      return;
    }
    if (soldSeatCodesForShowtime.has(seat.seatCode)) {
      showNotification('error', 'Ghế đã bán', `Ghế ${seat.seatCode} đã được bán trong đơn hàng trước đó.`);
      return;
    }
    if (heldByOtherSeatCodes.has(seat.seatCode)) {
      const hold = heldByOtherSeatCodes.get(seat.seatCode)!;
      const secsLeft = Math.max(1, Math.ceil((hold.expiresAt - nowTick) / 1000));
      showNotification(
        'error',
        'Ghế đang được người khác giữ (409 Conflict)',
        `Ghế ${seat.seatCode} đang được giữ bởi "${hold.holderName}". Tự động giải phóng sau ${secsLeft} giây nếu không thanh toán.`
      );
      return;
    }

    if (selectedSeats.includes(seat.seatCode)) {
      setSelectedSeats(prev => prev.filter(c => c !== seat.seatCode));
      setSeatHolds(prev => prev.filter(h => !(h.showtimeId === selectedShowtime.id && h.seatCode === seat.seatCode && h.holderSession === 'CURRENT_USER')));
    } else {
      if (selectedSeats.length >= 8) {
        showNotification('error', 'Giới hạn số ghế', 'Mỗi giao dịch tối đa được chọn 8 ghế.');
        return;
      }
      setSelectedSeats(prev => [...prev, seat.seatCode]);
      setSeatHolds(prev => [
        ...prev.filter(h => !(h.showtimeId === selectedShowtime.id && h.seatCode === seat.seatCode)),
        {
          id: `hold-${Date.now()}-${seat.seatCode}`,
          showtimeId: selectedShowtime.id,
          seatCode: seat.seatCode,
          holderSession: 'CURRENT_USER',
          holderName: 'Phiên của bạn',
          expiresAt: Date.now() + 300000
        }
      ]);
    }
  };

  const handleSimulateConcurrentCustomerHold = () => {
    if (!selectedShowtime || !selectedAuditorium) return;
    const freeSeat = selectedAuditorium.seats.find(
      s =>
        s.category !== 'DISABLED' &&
        !soldSeatCodesForShowtime.has(s.seatCode) &&
        !heldByOtherSeatCodes.has(s.seatCode) &&
        !selectedSeats.includes(s.seatCode)
    );
    if (!freeSeat) {
      showNotification('info', 'Không còn ghế trống', 'Tất cả ghế trong phòng đang được giữ hoặc đã bán.');
      return;
    }
    const newHold: SeatHold = {
      id: `sim-hold-${Date.now()}`,
      showtimeId: selectedShowtime.id,
      seatCode: freeSeat.seatCode,
      holderSession: `CONCURRENT_SESSION_${Math.floor(Math.random() * 900 + 100)}`,
      holderName: 'Khách đặt App Mobile (Giữ 45s)',
      expiresAt: Date.now() + 45000
    };
    setSeatHolds(prev => [...prev, newHold]);
    showNotification(
      'info',
      `Đã giả lập khách khác giữ ghế ${freeSeat.seatCode}`,
      `Ghế ${freeSeat.seatCode} vừa chuyển sang màu Vàng (khóa 45 giây). Hãy thử bấm vào ghế ${freeSeat.seatCode} để kiểm tra chặn trùng!`
    );
  };

  const bookingPricing = useMemo(() => {
    if (!selectedShowtime || !selectedAuditorium) {
      return { subtotal: 0, discount: 0, finalTotal: 0, items: [] as { seatCode: string; category: SeatCategory; price: number }[] };
    }
    const items = selectedSeats.map(code => {
      const seatObj = selectedAuditorium.seats.find(s => s.seatCode === code);
      const cat: SeatCategory = seatObj?.category || 'STANDARD';
      const price = getSeatUnitPrice(selectedShowtime.basePrice, cat);
      return { seatCode: code, category: cat, price };
    });
    const subtotal = items.reduce((sum, i) => sum + i.price, 0);

    let discount = 0;
    if (appliedPromo && subtotal >= appliedPromo.minOrderAmount) {
      if (appliedPromo.discountType === 'PERCENTAGE') {
        discount = Math.min(
          Math.round((subtotal * appliedPromo.discountValue) / 100),
          appliedPromo.maxDiscountAmount
        );
      } else {
        discount = Math.min(appliedPromo.discountValue, appliedPromo.maxDiscountAmount);
      }
    }
    const finalTotal = Math.max(0, subtotal - discount);
    return { subtotal, discount, finalTotal, items };
  }, [selectedSeats, selectedShowtime, selectedAuditorium, appliedPromo]);

  const handleApplyPromoCode = () => {
    const code = bookingPromoInput.trim().toUpperCase();
    if (!code) {
      setAppliedPromo(null);
      return;
    }
    const promo = promotions.find(p => p.code.toUpperCase() === code);
    if (!promo) {
      showNotification('error', 'Mã không tồn tại', `Mã khuyến mãi "${code}" không hợp lệ trong hệ thống.`);
      return;
    }
    const today = '2026-10-16';
    if (!promo.isActive || promo.endDate < today || promo.startDate > today) {
      showNotification('error', 'Mã đã hết hạn hoặc ngừng kích hoạt', `Chương trình "${promo.name}" đã kết thúc vào ${promo.endDate}.`);
      return;
    }
    if (promo.usedCount >= promo.usageLimit) {
      showNotification('error', 'Hết lượt sử dụng', `Mã "${code}" đã đạt giới hạn ${promo.usageLimit} lượt sử dụng.`);
      return;
    }
    if (bookingPricing.subtotal < promo.minOrderAmount) {
      showNotification(
        'error',
        'Chưa đạt giá trị đơn tối thiểu',
        `Mã "${code}" yêu cầu đơn hàng tối thiểu ${formatVND(promo.minOrderAmount)} (Hiện tại: ${formatVND(bookingPricing.subtotal)}).`
      );
      return;
    }
    setAppliedPromo(promo);
    showNotification('success', 'Áp dụng khuyến mãi thành công', `Đã áp dụng mã ${promo.code} (-${promo.discountType === 'PERCENTAGE' ? `${promo.discountValue}%` : formatVND(promo.discountValue)}).`);
  };

  const handleConfirmBooking = (markPaidImmediately: boolean) => {
    if (!selectedShowtime || !selectedAuditorium) return;
    if (selectedSeats.length === 0) {
      showNotification('error', 'Chưa chọn ghế', 'Vui lòng chọn ít nhất 1 ghế trên sơ đồ trước khi đặt vé.');
      return;
    }
    if (!bookingCustomerName.trim() || !bookingCustomerPhone.trim()) {
      showNotification('error', 'Thiếu thông tin khách hàng', 'Vui lòng nhập đầy đủ Họ tên và Số điện thoại người nhận vé.');
      return;
    }

    for (const code of selectedSeats) {
      if (soldSeatCodesForShowtime.has(code) || heldByOtherSeatCodes.has(code)) {
        showNotification(
          'error',
          'Giao dịch bị từ chối (Transaction Rollback)',
          `Ghế ${code} vừa được giao dịch khác khóa hoặc thanh toán. Vui lòng chọn ghế khác.`
        );
        return;
      }
    }

    const orderNum = Math.floor(1000 + Math.random() * 9000);
    const bookingCode = `ORD-261016-${orderNum}`;
    const tickets: TicketItem[] = bookingPricing.items.map(item => ({
      ticketCode: `TKT-${orderNum}-${item.seatCode}`,
      seatCode: item.seatCode,
      category: item.category,
      unitPrice: item.price,
      qrPayload: `CMS|${bookingCode}|TKT-${orderNum}-${item.seatCode}|${selectedShowtime.id}|${item.seatCode}`,
      isCheckedIn: false
    }));

    const status: BookingStatus = markPaidImmediately ? 'PAID' : 'PENDING';
    const newBooking: Booking = {
      id: `bk-${Date.now()}`,
      bookingCode,
      customerId: 'cus-01',
      customerName: bookingCustomerName.trim(),
      customerPhone: bookingCustomerPhone.trim(),
      customerEmail: bookingCustomerEmail.trim() || 'khachhang@gmail.com',
      showtimeId: selectedShowtime.id,
      cinemaId: selectedShowtime.cinemaId,
      auditoriumId: selectedShowtime.auditoriumId,
      movieId: selectedShowtime.movieId,
      seats: tickets,
      subtotalAmount: bookingPricing.subtotal,
      discountAmount: bookingPricing.discount,
      finalAmount: bookingPricing.finalTotal,
      promoCode: appliedPromo?.code,
      paymentMethod: bookingPaymentMethod,
      paymentStatus: status,
      transactionRef: markPaidImmediately
        ? `${bookingPaymentMethod === 'CASH' ? 'POS-CASH' : 'DEMO-GW'}-${Date.now().toString().slice(-6)}`
        : `PENDING-${Date.now().toString().slice(-6)}`,
      idempotencyKey: `IDEMP-${bookingCode}`,
      staffName: portalMode === 'ADMIN_CMS' ? 'Lê Thu Nhân Viên' : undefined,
      createdAt: new Date().toISOString()
    };

    setBookings(prev => [newBooking, ...prev]);

    if (appliedPromo) {
      setPromotions(prev =>
        prev.map(p => (p.id === appliedPromo.id ? { ...p, usedCount: p.usedCount + 1 } : p))
      );
    }

    if (markPaidImmediately) {
      const earnedPoints = Math.floor(bookingPricing.finalTotal / 10000);
      setCustomers(prev =>
        prev.map(c =>
          c.phone === bookingCustomerPhone.trim() || c.id === 'cus-01'
            ? {
                ...c,
                loyaltyPoints: c.loyaltyPoints + earnedPoints,
                totalTickets: c.totalTickets + tickets.length,
                totalSpent: c.totalSpent + bookingPricing.finalTotal
              }
            : c
        )
      );
    }

    setSeatHolds(prev =>
      prev.filter(h => !(h.showtimeId === selectedShowtime.id && selectedSeats.includes(h.seatCode)))
    );
    setSelectedSeats([]);
    setAppliedPromo(null);
    setBookingPromoInput('');

    appendAuditLog(
      markPaidImmediately ? 'CREATE_AND_PAY_BOOKING' : 'CREATE_PENDING_BOOKING',
      bookingCode,
      `Đặt ghế [${tickets.map(t => t.seatCode).join(', ')}] - Tổng thanh toán: ${formatVND(bookingPricing.finalTotal)} (${status})`
    );

    if (markPaidImmediately) {
      setActiveTicketModal(newBooking);
      showNotification(
        'success',
        'Đặt vé & xuất vé QR thành công!',
        `Mã đơn ${bookingCode} đã được xác nhận thanh toán (${formatVND(newBooking.finalAmount)}).`
      );
    } else {
      showNotification(
        'info',
        'Đã tạo đơn chờ thanh toán',
        `Mã đơn ${bookingCode} đang ở trạng thái CHỜ THANH TOÁN. Xác nhận callback tại mục Đơn đặt vé.`
      );
    }
  };

  const handleConfirmPendingOrder = (booking: Booking) => {
    if (!assertPermission('bookings:manage')) return;
    if (booking.paymentStatus !== 'PENDING') return;

    setBookings(prev =>
      prev.map(b =>
        b.id === booking.id
          ? {
              ...b,
              paymentStatus: 'PAID',
              transactionRef: `VERIFIED-${b.paymentMethod}-${Date.now().toString().slice(-5)}`
            }
          : b
      )
    );
    appendAuditLog(
      'CONFIRM_PAYMENT_WEBHOOK',
      booking.bookingCode,
      `Xác nhận thanh toán đơn hàng ${booking.bookingCode} (${formatVND(booking.finalAmount)}) với khóa chống lặp ${booking.idempotencyKey}`
    );
    showNotification(
      'success',
      'Xác nhận thanh toán thành công',
      `Đơn hàng ${booking.bookingCode} đã chuyển sang ĐÃ THANH TOÁN và kích hoạt mã QR vé điện tử.`
    );
  };

  const handleRefundBooking = (booking: Booking) => {
    if (!assertPermission('bookings:refund')) return;
    setConfirmModal({
      title: `Xác nhận hủy vé & hoàn tiền đơn ${booking.bookingCode}`,
      message: `Bạn có chắc chắn muốn hủy đơn ${booking.bookingCode} (${formatVND(booking.finalAmount)}) và giải phóng ghế [${booking.seats.map(s => s.seatCode).join(', ')}] về trạng thái trống?`,
      confirmLabel: 'Xác nhận hoàn tiền & mở khóa ghế',
      onConfirm: () => {
        const nextStatus: BookingStatus = booking.paymentStatus === 'PAID' ? 'REFUNDED' : 'CANCELLED';
        setBookings(prev =>
          prev.map(b =>
            b.id === booking.id
              ? {
                  ...b,
                  paymentStatus: nextStatus,
                  refundReason: 'Hoàn vé theo quy trình quản trị rạp',
                  refundedAt: new Date().toISOString()
                }
              : b
          )
        );
        appendAuditLog(
          nextStatus === 'REFUNDED' ? 'REFUND_BOOKING' : 'CANCEL_BOOKING',
          booking.bookingCode,
          `Xử lý ${nextStatus} cho đơn ${booking.bookingCode} (${formatVND(booking.finalAmount)}) - Giải phóng ghế ${booking.seats.map(s => s.seatCode).join(', ')}`
        );
        setConfirmModal(null);
        showNotification(
          'success',
          'Đã hủy đơn & giải phóng ghế',
          `Đơn ${booking.bookingCode} đã chuyển sang ${nextStatus}. Các ghế liên quan đã mở bán trở lại.`
        );
      }
    });
  };

  const handleCheckInTicket = (bookingId: string, ticketCode: string) => {
    if (!assertPermission('bookings:manage')) return;
    setBookings(prev =>
      prev.map(b => {
        if (b.id !== bookingId) return b;
        return {
          ...b,
          seats: b.seats.map(s => (s.ticketCode === ticketCode ? { ...s, isCheckedIn: true } : s))
        };
      })
    );
    appendAuditLog('TICKET_CHECKIN', ticketCode, `Soát vé QR thành công tại cổng kiểm soát cho mã vé ${ticketCode}`);
    showNotification('success', 'Soát vé hợp lệ!', `Mã vé ${ticketCode} đã được đóng dấu Check-in vào phòng chiếu.`);
  };

  const handleOpenMovieModal = (movie?: Movie) => {
    if (!assertPermission('movies:write')) return;
    if (movie) {
      setEditingMovie(movie);
      setMovieForm({ ...movie });
    } else {
      setEditingMovie(null);
      setMovieForm({
        code: `MV-2026-0${movies.length + 1}`,
        titleVi: '',
        titleOriginal: '',
        synopsis: '',
        posterUrl: POSTER_SCIFI_IMG,
        trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        genres: ['Hành động', 'Khoa học viễn tưởng'],
        director: '',
        cast: '',
        durationMinutes: 120,
        language: 'Tiếng Anh - Phụ đề Tiếng Việt',
        formats: ['2D Standard', 'IMAX Laser'],
        ageRating: 'T13',
        releaseDate: '2026-10-20',
        endDate: '2026-12-15',
        status: 'NOW_SHOWING'
      });
    }
    setIsMovieModalOpen(true);
  };

  const handleSaveMovie = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assertPermission('movies:write')) return;

    if (!movieForm.titleVi?.trim() || !movieForm.director?.trim() || !movieForm.durationMinutes || movieForm.durationMinutes < 45) {
      showNotification('error', 'Dữ liệu không hợp lệ', 'Vui lòng nhập Tên phim tiếng Việt, Đạo diễn và Thời lượng (>= 45 phút).');
      return;
    }

    if (editingMovie) {
      setMovies(prev => prev.map(m => (m.id === editingMovie.id ? ({ ...m, ...movieForm } as Movie) : m)));
      appendAuditLog('UPDATE_MOVIE', editingMovie.code, `Cập nhật thông tin phim "${movieForm.titleVi}"`);
      showNotification('success', 'Đã cập nhật phim', `Thông tin phim "${movieForm.titleVi}" đã được lưu vào CSDL.`);
    } else {
      const created: Movie = {
        ...(movieForm as Movie),
        id: `mov-${Date.now()}`
      };
      setMovies(prev => [created, ...prev]);
      appendAuditLog('CREATE_MOVIE', created.code, `Thêm phim mới "${created.titleVi}" (${created.durationMinutes} phút)`);
      showNotification('success', 'Thêm phim mới thành công', `Phim "${created.titleVi}" đã được thêm vào danh mục.`);
    }
    setIsMovieModalOpen(false);
  };

  const handleDeleteOrArchiveMovie = (movie: Movie) => {
    if (!assertPermission('movies:delete')) return;
    const hasActiveShowtimes = showtimes.some(s => s.movieId === movie.id && s.status !== 'CANCELLED');

    setConfirmModal({
      title: hasActiveShowtimes ? `Lưu trữ phim "${movie.titleVi}"` : `Xóa phim "${movie.titleVi}"`,
      message: hasActiveShowtimes
        ? `Phim "${movie.titleVi}" đang có suất chiếu liên kết. Hệ thống sẽ chuyển trạng thái sang NGỪNG CHIẾU (Xóa mềm / Lưu trữ) để bảo toàn lịch sử vé.`
        : `Bạn có chắc chắn muốn xóa phim "${movie.titleVi}" khỏi danh mục?`,
      confirmLabel: hasActiveShowtimes ? 'Chuyển sang Ngừng chiếu' : 'Xác nhận xóa',
      onConfirm: () => {
        if (hasActiveShowtimes) {
          setMovies(prev => prev.map(m => (m.id === movie.id ? { ...m, status: 'ENDED' } : m)));
          appendAuditLog('ARCHIVE_MOVIE', movie.code, `Chuyển trạng thái phim "${movie.titleVi}" sang Ngừng chiếu`);
          showNotification('info', 'Đã lưu trữ phim', `Phim "${movie.titleVi}" đã chuyển sang trạng thái Ngừng chiếu.`);
        } else {
          setMovies(prev => prev.filter(m => m.id !== movie.id));
          appendAuditLog('DELETE_MOVIE', movie.code, `Xóa phim "${movie.titleVi}" khỏi hệ thống`);
          showNotification('success', 'Đã xóa phim', `Phim "${movie.titleVi}" đã được xóa.`);
        }
        setConfirmModal(null);
      }
    });
  };

  const handlePaintAuditoriumSeat = (audId: string, seatCode: string) => {
    if (!assertPermission('auditoriums:write')) return;
    const hasSoldTicketOnSeat = bookings.some(
      b =>
        b.auditoriumId === audId &&
        (b.paymentStatus === 'PAID' || b.paymentStatus === 'PENDING') &&
        b.seats.some(s => s.seatCode === seatCode)
    );
    if (hasSoldTicketOnSeat) {
      showNotification(
        'error',
        'Không thể thay đổi ghế đã phát sinh vé',
        `Ghế ${seatCode} đang có vé đã bán trong suất chiếu sắp tới. Không được phép đổi cấu trúc hoặc khóa ghế này.`
      );
      return;
    }

    setAuditoriums(prev =>
      prev.map(aud => {
        if (aud.id !== audId) return aud;
        return {
          ...aud,
          seats: aud.seats.map(s => (s.seatCode === seatCode ? { ...s, category: seatBrushType, isActive: seatBrushType !== 'DISABLED' } : s))
        };
      })
    );
    appendAuditLog('UPDATE_SEAT_CONFIG', `${audId}:${seatCode}`, `Cập nhật loại ghế ${seatCode} thành ${seatBrushType}`);
  };

  const handleCreateShowtime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assertPermission('showtimes:write')) return;

    const movie = movies.find(m => m.id === newShowtimeForm.movieId);
    const aud = auditoriums.find(a => a.id === newShowtimeForm.auditoriumId);
    if (!movie || !aud) return;

    const startMins = timeToMinutes(newShowtimeForm.startTime);
    const totalDurationWithBuffer = movie.durationMinutes + cleaningBufferMins;
    const endMins = startMins + totalDurationWithBuffer;
    const computedEndTime = addMinutesToTime(newShowtimeForm.startTime, totalDurationWithBuffer);

    const conflict = showtimes.find(st => {
      if (st.auditoriumId !== newShowtimeForm.auditoriumId) return false;
      if (st.showDate !== newShowtimeForm.showDate) return false;
      if (st.status === 'CANCELLED') return false;

      const existingStart = timeToMinutes(st.startTime);
      const existingEnd = timeToMinutes(st.endTime) < existingStart
        ? timeToMinutes(st.endTime) + 1440
        : timeToMinutes(st.endTime);

      return startMins < existingEnd && endMins > existingStart;
    });

    if (conflict) {
      const conflictMovie = movies.find(m => m.id === conflict.movieId);
      showNotification(
        'error',
        'Xung đột lịch chiếu trong cùng phòng (409 Conflict)',
        `Phòng "${aud.name}" ngày ${newShowtimeForm.showDate} đã có suất chiếu phim "${conflictMovie?.titleVi}" từ ${conflict.startTime} đến ${conflict.endTime} (Đã tính ${cleaningBufferMins} phút vệ sinh phòng).`
      );
      return;
    }

    const created: Showtime = {
      id: `st-${Date.now()}`,
      movieId: newShowtimeForm.movieId,
      cinemaId: aud.cinemaId,
      auditoriumId: aud.id,
      showDate: newShowtimeForm.showDate,
      startTime: newShowtimeForm.startTime,
      endTime: computedEndTime,
      format: newShowtimeForm.format,
      basePrice: Number(newShowtimeForm.basePrice),
      status: 'OPEN_FOR_SALE'
    };

    setShowtimes(prev => [...prev, created]);
    appendAuditLog(
      'CREATE_SHOWTIME',
      created.id,
      `Tạo lịch chiếu phim "${movie.titleVi}" tại ${aud.name} ngày ${created.showDate} (${created.startTime} - ${created.endTime})`
    );
    setIsShowtimeModalOpen(false);
    showNotification(
      'success',
      'Tạo suất chiếu thành công',
      `Suất chiếu ${created.startTime} - ${created.endTime} (bao gồm ${cleaningBufferMins} phút dọn phòng) đã mở bán.`
    );
  };

  const handleExportReportCSV = () => {
    if (!assertPermission('reports:view')) return;
    const headers = ['Ma_Don', 'Khach_Hang', 'So_Dien_Thoai', 'Phim', 'So_Ghe', 'Tam_Tinh_VND', 'Giam_Gia_VND', 'Thuc_Thu_VND', 'Phuong_Thuc', 'Trang_Thai', 'Thoi_Gian'];
    const rows = bookings.map(b => {
      const mv = movies.find(m => m.id === b.movieId)?.titleVi || b.movieId;
      return [
        b.bookingCode,
        `"${b.customerName}"`,
        b.customerPhone,
        `"${mv}"`,
        `"${b.seats.map(s => s.seatCode).join(' ')}"`,
        b.subtotalAmount,
        b.discountAmount,
        b.finalAmount,
        b.paymentMethod,
        b.paymentStatus,
        b.createdAt
      ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CMS_Bao_Cao_Doanh_Thu_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    appendAuditLog('EXPORT_REPORT_CSV', 'REVENUE_REPORT', 'Xuất file báo cáo doanh thu định dạng CSV');
    showNotification('success', 'Đã xuất báo cáo CSV', 'Tập tin báo cáo doanh thu đã được tải xuống máy của bạn.');
  };

  const filteredMovies = useMemo(() => {
    return movies
      .filter(m => {
        const matchSearch =
          m.titleVi.toLowerCase().includes(movieSearch.toLowerCase()) ||
          m.titleOriginal.toLowerCase().includes(movieSearch.toLowerCase()) ||
          m.code.toLowerCase().includes(movieSearch.toLowerCase());
        const matchGenre = movieGenreFilter === 'ALL' || m.genres.includes(movieGenreFilter);
        const matchStatus = movieStatusFilter === 'ALL' || m.status === movieStatusFilter;
        const matchAge = movieAgeFilter === 'ALL' || m.ageRating === movieAgeFilter;
        return matchSearch && matchGenre && matchStatus && matchAge;
      })
      .sort((a, b) => {
        if (movieSortBy === 'title') return a.titleVi.localeCompare(b.titleVi);
        if (movieSortBy === 'duration') return b.durationMinutes - a.durationMinutes;
        return b.releaseDate.localeCompare(a.releaseDate);
      });
  }, [movies, movieSearch, movieGenreFilter, movieStatusFilter, movieAgeFilter, movieSortBy]);

  const MOVIES_PER_PAGE = 6;
  const totalMoviePages = Math.max(1, Math.ceil(filteredMovies.length / MOVIES_PER_PAGE));
  const paginatedMovies = filteredMovies.slice((moviePage - 1) * MOVIES_PER_PAGE, moviePage * MOVIES_PER_PAGE);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-red-600 selection:text-white">
      {/* Global Role & Portal Switcher Bar */}
      <div className="bg-zinc-950 text-zinc-200 border-b border-zinc-800 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 z-40">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Cinema Management System (CMS v2.4)
          </span>
          <span className="hidden md:inline text-zinc-400">
            Múi giờ: <strong className="text-zinc-200">Asia/Ho_Chi_Minh (GMT+7)</strong> • Tiền tệ: <strong className="text-zinc-200">VNĐ</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-zinc-400 font-medium">Chuyển nhanh vai trò (RBAC Demo):</span>
          {(['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER'] as RoleCode[]).map(role => (
            <button
              key={role}
              onClick={() => handleSwitchRole(role)}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                currentRole === role
                  ? 'bg-red-600 text-white shadow-sm shadow-red-600/50'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800'
              }`}
            >
              {role === 'ADMIN' && 'Quản trị (Admin)'}
              {role === 'MANAGER' && 'Quản lý (Manager)'}
              {role === 'STAFF' && 'Nhân viên (Staff POS)'}
              {role === 'CUSTOMER' && 'Khách hàng (Customer)'}
            </button>
          ))}

          <div className="h-4 w-px bg-zinc-800 mx-1 hidden sm:block" />

          <button
            onClick={() => {
              if (portalMode === 'ADMIN_CMS') {
                setPortalMode('CUSTOMER_WEB');
                setCustomerView('HOME');
              } else {
                if (currentRole === 'CUSTOMER') {
                  showNotification('error', 'Truy cập bị chặn (RBAC)', 'Tài khoản Khách hàng không được phép truy cập Cổng Quản Trị Nội Bộ. Hãy chọn vai trò Admin/Manager/Staff.');
                  return;
                }
                setPortalMode('ADMIN_CMS');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white font-semibold transition"
          >
            {portalMode === 'ADMIN_CMS' ? (
              <>
                <Compass className="w-3.5 h-3.5 text-red-600" />
                Mở Website Khách Hàng
              </>
            ) : (
              <>
                <LayoutDashboard className="w-3.5 h-3.5 text-red-600" />
                Về Cổng Quản Trị CMS
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md w-full bg-zinc-900 text-white border border-zinc-700 rounded-xl shadow-2xl p-4 flex items-start gap-3">
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />}
          <div className="flex-1 text-sm">
            <div className="font-bold text-white">{toast.title}</div>
            <div className="text-zinc-300 mt-0.5 leading-relaxed">{toast.message}</div>
          </div>
          <button onClick={() => setToast(null)} className="text-zinc-400 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2.5 rounded-full bg-red-50">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{confirmModal.title}</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-sm"
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Electronic Ticket QR Modal */}
      {activeTicketModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-950 text-white border border-zinc-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-red-700 via-red-600 to-zinc-900 p-5 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider text-red-200 font-semibold">Vé Điện Tử Chính Thức (E-Ticket)</span>
                <h3 className="text-xl font-bold mt-0.5">{activeTicketModal.bookingCode}</h3>
              </div>
              <button
                onClick={() => setActiveTicketModal(null)}
                className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex justify-between items-start border-b border-zinc-800 pb-4">
                <div>
                  <div className="text-xs text-zinc-400">Phim chiếu</div>
                  <div className="text-lg font-bold text-white">
                    {movies.find(m => m.id === activeTicketModal.movieId)?.titleVi}
                  </div>
                  <div className="text-xs text-red-400 font-medium mt-1">
                    {cinemas.find(c => c.id === activeTicketModal.cinemaId)?.name} •{' '}
                    {auditoriums.find(a => a.id === activeTicketModal.auditoriumId)?.name}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  activeTicketModal.paymentStatus === 'PAID'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {activeTicketModal.paymentStatus === 'PAID' ? 'ĐÃ THANH TOÁN' : activeTicketModal.paymentStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm bg-zinc-900/90 p-4 rounded-xl border border-zinc-800">
                <div>
                  <span className="text-zinc-400 text-xs block">Khách hàng</span>
                  <strong className="text-white">{activeTicketModal.customerName}</strong>
                  <span className="text-zinc-400 text-xs block mt-0.5">{activeTicketModal.customerPhone}</span>
                </div>
                <div>
                  <span className="text-zinc-400 text-xs block">Suất chiếu</span>
                  <strong className="text-white">
                    {showtimes.find(s => s.id === activeTicketModal.showtimeId)?.startTime} -{' '}
                    {showtimes.find(s => s.id === activeTicketModal.showtimeId)?.showDate}
                  </strong>
                  <span className="text-zinc-400 text-xs block mt-0.5">
                    Ghế: <strong className="text-red-400">{activeTicketModal.seats.map(s => s.seatCode).join(', ')}</strong>
                  </span>
                </div>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {activeTicketModal.seats.map(tk => (
                  <div key={tk.ticketCode} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-white p-1.5 rounded-lg flex flex-col items-center justify-center text-zinc-950">
                        <QrCode className="w-9 h-9" />
                        <span className="text-[8px] font-mono font-bold leading-none mt-0.5">{tk.seatCode}</span>
                      </div>
                      <div>
                        <div className="font-mono text-xs font-bold text-red-400">{tk.ticketCode}</div>
                        <div className="text-sm font-semibold text-white">
                          Ghế {tk.seatCode} ({tk.category}) — {formatVND(tk.unitPrice)}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono truncate max-w-[210px]">{tk.qrPayload}</div>
                      </div>
                    </div>
                    <div>
                      {tk.isCheckedIn ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                          <Check className="w-3.5 h-3.5" /> Đã vào rạp
                        </span>
                      ) : activeTicketModal.paymentStatus === 'PAID' ? (
                        <button
                          onClick={() => handleCheckInTicket(activeTicketModal.id, tk.ticketCode)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                        >
                          Soát vé QR
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                <div>
                  <span className="text-xs text-zinc-400 block">Tổng thanh toán</span>
                  <span className="text-xl font-bold text-red-400">{formatVND(activeTicketModal.finalAmount)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      showNotification('success', 'Đã gửi lệnh in nhiệt POS', `Đang in ${activeTicketModal.seats.length} vé nhiệt 80mm cho đơn ${activeTicketModal.bookingCode}.`);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold"
                  >
                    <Printer className="w-4 h-4" /> In vé tại quầy
                  </button>
                  <button
                    onClick={() => setActiveTicketModal(null)}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
                  >
                    Hoàn tất
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {portalMode === 'ADMIN_CMS' ? (
        <div className="flex-1 flex flex-col lg:flex-row">
          <aside className="w-full lg:w-64 bg-zinc-950 text-zinc-300 border-b lg:border-b-0 lg:border-r border-zinc-800 shrink-0 flex flex-col justify-between">
            <div>
              <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
                    <Film className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-white tracking-tight text-base leading-none">CINEMA CMS</div>
                    <div className="text-[11px] text-red-400 font-semibold mt-1">Hệ Thống Quản Trị Rạp</div>
                  </div>
                </div>
              </div>

              <nav className="p-3 space-y-1 flex lg:flex-col overflow-x-auto">
                {[
                  { id: 'dashboard', label: 'Dashboard Tổng Quan', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER'] },
                  { id: 'pos', label: 'Sơ Đồ Ghế & Bán Vé POS', icon: Armchair, roles: ['ADMIN', 'MANAGER', 'STAFF'] },
                  { id: 'movies', label: 'Quản Lý Phim', icon: Film, roles: ['ADMIN', 'MANAGER', 'STAFF'] },
                  { id: 'auditoriums', label: 'Cụm Rạp & Phòng Chiếu', icon: Building2, roles: ['ADMIN', 'MANAGER'] },
                  { id: 'showtimes', label: 'Quản Lý Lịch Chiếu', icon: Calendar, roles: ['ADMIN', 'MANAGER', 'STAFF'] },
                  { id: 'bookings', label: 'Đơn Đặt Vé & Thanh Toán', icon: Ticket, roles: ['ADMIN', 'MANAGER', 'STAFF'] },
                  { id: 'customers', label: 'Quản Lý Khách Hàng', icon: Users, roles: ['ADMIN', 'MANAGER', 'STAFF'] },
                  { id: 'promotions', label: 'Chương Trình Khuyến Mãi', icon: Tag, roles: ['ADMIN', 'MANAGER'] },
                  { id: 'employees', label: 'Nhân Viên & Phân Quyền', icon: UserCheck, roles: ['ADMIN', 'MANAGER'] },
                  { id: 'reports', label: 'Báo Cáo & Thống Kê', icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
                  { id: 'audit', label: 'Nhật Ký Hoạt Động', icon: ShieldAlert, roles: ['ADMIN'] }
                ]
                  .filter(item => item.roles.includes(currentRole))
                  .map(item => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all w-full text-left ${
                          active
                            ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
                            : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
              </nav>
            </div>

            <div className="hidden lg:block p-4 m-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center font-bold text-sm">
                  {currentRole.slice(0, 2)}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-white truncate">
                    {currentRole === 'ADMIN' && 'Nguyễn Hoàng Quản Trị'}
                    {currentRole === 'MANAGER' && 'Trần Minh Quản Lý'}
                    {currentRole === 'STAFF' && 'Lê Thu Nhân Viên'}
                  </div>
                  <div className="text-[11px] text-zinc-400">Vai trò: {currentRole}</div>
                </div>
              </div>
            </div>
          </aside>

          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      Dashboard Quản Trị Cụm Rạp
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Số liệu tổng hợp thời gian thực từ cơ sở dữ liệu giao dịch • Ngày hiện tại: 16/10/2026
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={dashboardCinemaFilter}
                      onChange={e => setDashboardCinemaFilter(e.target.value)}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700"
                    >
                      <option value="ALL">Tất cả cơ sở rạp ({cinemas.length} cụm rạp)</option>
                      {cinemas.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setActiveTab('pos')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-sm"
                    >
                      <Ticket className="w-4 h-4" /> Mở Quầy Bán Vé POS
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                      <span>DOANH THU THUẦN</span>
                      <span className="p-1.5 rounded-lg bg-red-50 text-red-600"><DollarSign className="w-4 h-4" /></span>
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 mt-2">{formatVND(analytics.netRevenue)}</div>
                    <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold mt-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> +14.8% so với hôm qua
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                      <span>TỔNG VÉ ĐÃ BÁN</span>
                      <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Ticket className="w-4 h-4" /></span>
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 mt-2">{analytics.totalTicketsSold} vé</div>
                    <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold mt-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> Giá TB: {formatVND(analytics.avgOrderValue)}/đơn
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                      <span>TỶ LỆ LẤP ĐẦY GHẾ</span>
                      <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Percent className="w-4 h-4" /></span>
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 mt-2">{analytics.occupancyRate}%</div>
                    <div className="text-xs text-slate-500 mt-1.5">
                      Trên {analytics.activeShowtimesCount} suất đang mở bán
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                      <span>PHIM ĐANG CHIẾU</span>
                      <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600"><Film className="w-4 h-4" /></span>
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 mt-2">{analytics.nowShowingMoviesCount} phim</div>
                    <div className="text-xs text-slate-500 mt-1.5">
                      Tổng danh mục: {movies.length} phim
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                      <span>KHÁCH HÀNG THÀNH VIÊN</span>
                      <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><Users className="w-4 h-4" /></span>
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 mt-2">{customers.length} KH</div>
                    <div className="text-xs text-emerald-600 font-semibold mt-1.5">
                      Đang hoạt động: {customers.filter(c => c.status === 'ACTIVE').length}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                      <span>HOÀN TIỀN / CHỜ TT</span>
                      <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700"><RefreshCw className="w-4 h-4" /></span>
                    </div>
                    <div className="text-xl font-extrabold text-rose-600 mt-2">{formatVND(analytics.totalRefundedAmount)}</div>
                    <div className="text-xs text-amber-600 font-semibold mt-1.5">
                      Chờ TT: {formatVND(analytics.pendingRevenue)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-slate-900">Biểu Đồ Doanh Thu Thuần & Hoàn Tiền Theo Ngày</h3>
                        <p className="text-xs text-slate-500">Không tính các đơn hàng đang chờ thanh toán vào doanh thu thực nhận</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-red-50 text-red-600">7 ngày gần nhất</span>
                    </div>
                    <div className="relative h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.dailySeries}>
                          <defs>
                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#dc2626" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                          <YAxis tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(val: number) => formatVND(val)} />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            name="Doanh thu thuần (VNĐ)"
                            stroke="#dc2626"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#revGrad)"
                          />
                          <Area
                            type="monotone"
                            dataKey="refund"
                            name="Hoàn tiền (VNĐ)"
                            stroke="#64748b"
                            strokeWidth={2}
                            fillOpacity={0.1}
                            fill="#64748b"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="mb-4">
                      <h3 className="font-bold text-slate-900">Top Phim Có Doanh Thu Cao Nhất</h3>
                      <p className="text-xs text-slate-500">Tổng hợp trực tiếp từ các đơn vé ĐÃ THANH TOÁN</p>
                    </div>
                    <div className="relative h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.revenueByMovie.slice(0, 5)} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="title" width={125} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(val: number) => formatVND(val)} />
                          <Bar dataKey="revenue" name="Doanh thu (VNĐ)" radius={[0, 6, 6, 0]}>
                            {analytics.revenueByMovie.slice(0, 5).map((_, idx) => (
                              <Cell key={idx} fill={idx === 0 ? '#dc2626' : idx === 1 ? '#ea580c' : '#334155'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900">Suất Chiếu Sắp Bắt Đầu</h3>
                      <button onClick={() => setActiveTab('showtimes')} className="text-xs font-semibold text-red-600 hover:underline">
                        Xem toàn bộ lịch
                      </button>
                    </div>
                    <div className="space-y-3">
                      {showtimes.slice(0, 5).map(st => {
                        const mv = movies.find(m => m.id === st.movieId);
                        const aud = auditoriums.find(a => a.id === st.auditoriumId);
                        return (
                          <div key={st.id} className="p-3 rounded-xl border border-slate-200 hover:border-red-200 flex items-center justify-between gap-3">
                            <div>
                              <div className="font-bold text-sm text-slate-900">{mv?.titleVi}</div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {aud?.name} • {st.showDate} ({st.startTime} - {st.endTime})
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedShowtimeId(st.id);
                                setSelectedSeats([]);
                                setActiveTab('pos');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-600 hover:text-white text-red-600 text-xs font-bold transition shrink-0"
                            >
                              Bán vé
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900">Giao Dịch Đặt Vé Mới Nhất</h3>
                      <button onClick={() => setActiveTab('bookings')} className="text-xs font-semibold text-red-600 hover:underline">
                        Quản lý đơn hàng
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                            <th className="py-2.5 px-2">Mã đơn</th>
                            <th className="py-2.5 px-2">Khách hàng</th>
                            <th className="py-2.5 px-2">Ghế</th>
                            <th className="py-2.5 px-2 text-right">Tổng tiền</th>
                            <th className="py-2.5 px-2 text-center">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bookings.slice(0, 5).map(bk => (
                            <tr key={bk.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-2 font-mono text-xs font-bold text-red-600">{bk.bookingCode}</td>
                              <td className="py-2.5 px-2 font-medium text-slate-800">{bk.customerName}</td>
                              <td className="py-2.5 px-2 text-xs font-semibold text-slate-600">{bk.seats.map(s => s.seatCode).join(', ')}</td>
                              <td className="py-2.5 px-2 text-right font-bold text-slate-900">{formatVND(bk.finalAmount)}</td>
                              <td className="py-2.5 px-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  bk.paymentStatus === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : bk.paymentStatus === 'PENDING'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}>
                                  {bk.paymentStatus === 'PAID' && 'Đã thanh toán'}
                                  {bk.paymentStatus === 'PENDING' && 'Chờ thanh toán'}
                                  {bk.paymentStatus === 'REFUNDED' && 'Đã hoàn tiền'}
                                  {bk.paymentStatus === 'CANCELLED' && 'Đã hủy'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pos' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">
                      Sơ Đồ Ghế Trực Quan & Bán Vé Tại Quầy (POS)
                    </h1>
                    <p className="text-sm text-slate-500">
                      Hỗ trợ giữ ghế tạm thời (TTL 5 phút), khóa chống bán trùng ghế (Serializable Lock) và xuất vé QR điện tử
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                    <QrCode className="w-5 h-5 text-red-600 ml-2" />
                    <input
                      type="text"
                      value={ticketLookupQuery}
                      onChange={e => setTicketLookupQuery(e.target.value)}
                      placeholder="Nhập mã đơn / mã vé QR (VD: ORD-261016-8801)..."
                      className="text-sm px-2 py-1 outline-none w-64"
                    />
                    <button
                      onClick={() => {
                        const q = ticketLookupQuery.trim().toUpperCase();
                        const found = bookings.find(
                          b => b.bookingCode.toUpperCase() === q || b.seats.some(s => s.ticketCode.toUpperCase() === q)
                        );
                        if (found) {
                          setActiveTicketModal(found);
                        } else {
                          showNotification('error', 'Không tìm thấy vé', `Không có đơn đặt vé hoặc mã vé nào khớp với "${q}".`);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold"
                    >
                      Tra cứu & Soát vé
                    </button>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs font-bold uppercase text-slate-500">Chọn suất chiếu:</label>
                    <select
                      value={selectedShowtimeId}
                      onChange={e => {
                        setSelectedShowtimeId(e.target.value);
                        setSelectedSeats([]);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-sm font-bold text-slate-900"
                    >
                      {showtimes.map(st => {
                        const mv = movies.find(m => m.id === st.movieId);
                        const aud = auditoriums.find(a => a.id === st.auditoriumId);
                        return (
                          <option key={st.id} value={st.id}>
                            [{st.showDate} • {st.startTime}] {mv?.titleVi} — {aud?.name} ({formatVND(st.basePrice)})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <button
                    onClick={handleSimulateConcurrentCustomerHold}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 text-amber-800 border border-amber-400/40 hover:bg-amber-500/25 text-xs font-bold transition"
                  >
                    <Clock className="w-4 h-4 text-amber-600" />
                    Giả lập khách khác giữ ghế đồng thời (Test Concurrency)
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8 bg-zinc-950 text-white p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col items-center">
                    <div className="w-full max-w-xl mb-8 text-center">
                      <div className="h-3 w-full bg-gradient-to-r from-transparent via-red-500 to-transparent rounded-t-full shadow-[0_12px_30px_rgba(239,68,68,0.65)]" />
                      <div className="text-[11px] uppercase tracking-[0.35em] text-zinc-400 font-semibold mt-2">
                        MÀN HÌNH CHIẾU PHIM ({selectedShowtime?.format})
                      </div>
                    </div>

                    <div className="w-full overflow-x-auto flex justify-center py-2">
                      <div className="space-y-2.5">
                        {Array.from(new Set(selectedAuditorium.seats.map(s => s.rowLabel))).map(rowLabel => {
                          const rowSeats = selectedAuditorium.seats
                            .filter(s => s.rowLabel === rowLabel)
                            .sort((a, b) => a.colNumber - b.colNumber);
                          return (
                            <div key={rowLabel} className="flex items-center gap-2">
                              <span className="w-6 text-xs font-bold text-zinc-400 text-center">{rowLabel}</span>
                              <div className="flex items-center gap-1.5">
                                {rowSeats.map(seat => {
                                  const isSold = soldSeatCodesForShowtime.has(seat.seatCode);
                                  const isHeldOther = heldByOtherSeatCodes.has(seat.seatCode);
                                  const isSelected = selectedSeats.includes(seat.seatCode);
                                  const isDisabled = seat.category === 'DISABLED' || !seat.isActive;

                                  let seatColorClass = 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-600';
                                  if (seat.category === 'VIP' && !isSold && !isHeldOther && !isSelected && !isDisabled) {
                                    seatColorClass = 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border-amber-500/60';
                                  } else if (seat.category === 'COUPLE' && !isSold && !isHeldOther && !isSelected && !isDisabled) {
                                    seatColorClass = 'bg-zinc-800 hover:bg-zinc-700 text-pink-300 border-pink-500/60';
                                  }

                                  if (isDisabled) {
                                    seatColorClass = 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed';
                                  } else if (isSold) {
                                    seatColorClass = 'bg-red-600 text-white border-red-500 cursor-not-allowed opacity-90';
                                  } else if (isHeldOther) {
                                    seatColorClass = 'bg-amber-500 text-zinc-950 border-amber-400 font-extrabold cursor-not-allowed animate-pulse';
                                  } else if (isSelected) {
                                    seatColorClass = 'bg-sky-600 text-white border-sky-400 ring-2 ring-sky-400/50 font-extrabold';
                                  }

                                  return (
                                    <button
                                      key={seat.seatCode}
                                      type="button"
                                      onClick={() => handleToggleSeat(seat)}
                                      title={`${seat.seatCode} - ${seat.category} (${formatVND(getSeatUnitPrice(selectedShowtime.basePrice, seat.category))})`}
                                      className={`h-9 ${
                                        seat.category === 'COUPLE' ? 'w-12' : 'w-9'
                                      } rounded-t-lg border text-[11px] font-semibold transition-all flex items-center justify-center ${seatColorClass}`}
                                    >
                                      {seat.seatCode}
                                    </button>
                                  );
                                })}
                              </div>
                              <span className="w-6 text-xs font-bold text-zinc-400 text-center">{rowLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-8 pt-5 border-t border-zinc-800 w-full flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-300">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-t bg-zinc-800 border border-zinc-600 inline-block" />
                        <span>Ghế trống (Thường)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-t bg-zinc-800 border border-amber-500 inline-block" />
                        <span>Ghế trống (VIP +25k)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-4 rounded-t bg-zinc-800 border border-pink-500 inline-block" />
                        <span>Ghế đôi (Couple)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-t bg-sky-600 border border-sky-400 inline-block" />
                        <span>Đang chọn (Màu xanh)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-t bg-red-600 border border-red-500 inline-block" />
                        <span>Đã bán (Màu đỏ)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-t bg-amber-500 border border-amber-400 inline-block" />
                        <span>Người khác đang giữ (Vàng)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-t bg-zinc-900 border border-zinc-800 inline-block" />
                        <span>Không sử dụng (Xám đậm)</span>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-5">
                    <div className="space-y-4">
                      <div className="border-b border-slate-200 pb-3">
                        <span className="text-xs font-bold uppercase text-red-600">Chi tiết hóa đơn đặt vé</span>
                        <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">{selectedMovieForShowtime?.titleVi}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {selectedAuditorium?.name} • Suất {selectedShowtime?.startTime} ({selectedShowtime?.showDate})
                        </p>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-600 mb-2">
                          Ghế đang chọn ({selectedSeats.length}):
                        </div>
                        {bookingPricing.items.length === 0 ? (
                          <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                            Chưa chọn ghế nào. Hãy bấm vào ghế trống trên sơ đồ bên trái.
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {bookingPricing.items.map(item => (
                              <div key={item.seatCode} className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                                <span className="font-bold text-slate-800">
                                  Ghế {item.seatCode} <span className="text-slate-500 font-normal">({item.category})</span>
                                </span>
                                <span className="font-bold text-slate-900">{formatVND(item.price)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Mã khuyến mãi (Thử: <code className="text-red-600">CMSWELCOME20</code> hoặc <code className="text-red-600">IMAX50K</code>)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={bookingPromoInput}
                            onChange={e => setBookingPromoInput(e.target.value)}
                            placeholder="Nhập mã giảm giá..."
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-sm uppercase"
                          />
                          <button
                            type="button"
                            onClick={handleApplyPromoCode}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                          >
                            Áp dụng
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2.5 pt-2 border-t border-slate-200">
                        <div className="text-xs font-bold text-slate-700">Thông tin khách hàng nhận vé</div>
                        <input
                          type="text"
                          value={bookingCustomerName}
                          onChange={e => setBookingCustomerName(e.target.value)}
                          placeholder="Họ và tên khách hàng *"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={bookingCustomerPhone}
                            onChange={e => setBookingCustomerPhone(e.target.value)}
                            placeholder="Số điện thoại *"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                          />
                          <input
                            type="email"
                            value={bookingCustomerEmail}
                            onChange={e => setBookingCustomerEmail(e.target.value)}
                            placeholder="Email nhận QR"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Phương thức thanh toán</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'CASH', label: 'Tiền mặt' },
                            { id: 'BANK_TRANSFER', label: 'VietQR' },
                            { id: 'ONLINE_GATEWAY', label: 'Cổng Online' }
                          ].map(pm => (
                            <button
                              key={pm.id}
                              type="button"
                              onClick={() => setBookingPaymentMethod(pm.id as PaymentMethod)}
                              className={`py-2 px-2 rounded-lg border text-xs font-bold transition ${
                                bookingPaymentMethod === pm.id
                                  ? 'bg-red-50 border-red-600 text-red-700'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {pm.label}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                          <strong>Chế độ Cổng Thanh Toán ({paymentMode}):</strong> Đang chạy chế độ <strong>DEMO SANDBOX</strong> tách biệt hoàn toàn với Production.
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 space-y-3">
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between text-slate-600">
                          <span>Tạm tính:</span>
                          <span className="font-semibold">{formatVND(bookingPricing.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600">
                          <span>Giảm giá khuyến mãi:</span>
                          <span className="font-semibold">-{formatVND(bookingPricing.discount)}</span>
                        </div>
                        <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1 border-t border-slate-100">
                          <span>Tổng thanh toán:</span>
                          <span className="text-red-600">{formatVND(bookingPricing.finalTotal)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => handleConfirmBooking(true)}
                          className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-600/20 flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Xác Nhận Thanh Toán & Xuất Vé QR
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmBooking(false)}
                          className="w-full py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs"
                        >
                          Tạo đơn Chờ Thanh Toán (Xác nhận Callback sau)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'movies' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">Quản Lý Danh Mục Phim Điện Ảnh</h1>
                    <p className="text-sm text-slate-500">
                      Quản lý thông tin phim, định dạng chiếu, phân loại độ tuổi (P, K, T13, T16, T18) và trạng thái phát hành
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpenMovieModal()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Thêm Phim Mới
                  </button>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="relative lg:col-span-2">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={movieSearch}
                      onChange={e => {
                        setMovieSearch(e.target.value);
                        setMoviePage(1);
                      }}
                      placeholder="Tìm theo tên phim tiếng Việt, tên gốc, mã phim..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>

                  <select
                    value={movieStatusFilter}
                    onChange={e => {
                      setMovieStatusFilter(e.target.value);
                      setMoviePage(1);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="ALL">Mọi trạng thái chiếu</option>
                    <option value="NOW_SHOWING">Đang chiếu</option>
                    <option value="COMING_SOON">Sắp chiếu</option>
                    <option value="ENDED">Ngừng chiếu</option>
                  </select>

                  <select
                    value={movieAgeFilter}
                    onChange={e => {
                      setMovieAgeFilter(e.target.value);
                      setMoviePage(1);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="ALL">Mọi phân loại độ tuổi</option>
                    <option value="P">P - Phổ biến mọi độ tuổi</option>
                    <option value="K">K - Dưới 13 tuổi có giám hộ</option>
                    <option value="T13">T13 - Từ 13 tuổi trở lên</option>
                    <option value="T16">T16 - Từ 16 tuổi trở lên</option>
                    <option value="T18">T18 - Từ 18 tuổi trở lên</option>
                  </select>

                  <select
                    value={movieSortBy}
                    onChange={e => setMovieSortBy(e.target.value as 'title' | 'releaseDate' | 'duration')}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="releaseDate">Sắp xếp: Ngày khởi chiếu</option>
                    <option value="title">Sắp xếp: Tên phim (A-Z)</option>
                    <option value="duration">Sắp xếp: Thời lượng giảm dần</option>
                  </select>
                </div>

                {paginatedMovies.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <Film className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <h3 className="font-bold text-slate-800">Không tìm thấy bộ phim nào</h3>
                    <p className="text-xs text-slate-500 mt-1">Hãy thử điều chỉnh bộ lọc tìm kiếm hoặc thêm phim mới.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                            <th className="py-3 px-4">Phim</th>
                            <th className="py-3 px-3">Thể loại & Định dạng</th>
                            <th className="py-3 px-3">Thời lượng</th>
                            <th className="py-3 px-3">Độ tuổi</th>
                            <th className="py-3 px-3">Khởi chiếu</th>
                            <th className="py-3 px-3">Trạng thái</th>
                            <th className="py-3 px-4 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedMovies.map(movie => (
                            <tr key={movie.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={movie.posterUrl}
                                    alt={movie.titleVi}
                                    className="w-11 h-16 object-cover rounded-lg border border-slate-200 shrink-0"
                                  />
                                  <div>
                                    <div className="text-[11px] font-mono text-slate-400">{movie.code}</div>
                                    <div className="font-bold text-slate-900">{movie.titleVi}</div>
                                    <div className="text-xs text-slate-500">{movie.titleOriginal} • ĐD: {movie.director}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="text-xs font-medium text-slate-700">{movie.genres.join(', ')}</div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {movie.formats.map(f => (
                                    <span key={f} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3 px-3 font-semibold text-slate-700">{movie.durationMinutes} phút</td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-extrabold ${
                                  movie.ageRating === 'T18'
                                    ? 'bg-red-600 text-white'
                                    : movie.ageRating === 'T16'
                                    ? 'bg-orange-500 text-white'
                                    : movie.ageRating === 'T13'
                                    ? 'bg-amber-500 text-zinc-950'
                                    : 'bg-emerald-600 text-white'
                                }`}>
                                  {movie.ageRating}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-xs text-slate-600">{movie.releaseDate}</td>
                              <td className="py-3 px-3">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  movie.status === 'NOW_SHOWING'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : movie.status === 'COMING_SOON'
                                    ? 'bg-sky-100 text-sky-700'
                                    : 'bg-slate-200 text-slate-600'
                                }`}>
                                  {movie.status === 'NOW_SHOWING' && 'Đang chiếu'}
                                  {movie.status === 'COMING_SOON' && 'Sắp chiếu'}
                                  {movie.status === 'ENDED' && 'Ngừng chiếu'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenMovieModal(movie)}
                                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                                    title="Chỉnh sửa phim"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOrArchiveMovie(movie)}
                                    className="p-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                                    title="Xóa hoặc Lưu trữ phim"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                      <span>
                        Hiển thị {paginatedMovies.length} / {filteredMovies.length} phim
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={moviePage <= 1}
                          onClick={() => setMoviePage(p => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 font-semibold"
                        >
                          Trước
                        </button>
                        <span className="font-bold">Trang {moviePage} / {totalMoviePages}</span>
                        <button
                          disabled={moviePage >= totalMoviePages}
                          onClick={() => setMoviePage(p => Math.min(totalMoviePages, p + 1))}
                          className="px-2.5 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 font-semibold"
                        >
                          Sau
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {isMovieModalOpen && (
                  <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                    <form
                      onSubmit={handleSaveMovie}
                      className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <h3 className="text-lg font-extrabold text-slate-900">
                          {editingMovie ? `Chỉnh Sửa Phim: ${editingMovie.titleVi}` : 'Thêm Bộ Phim Mới'}
                        </h3>
                        <button type="button" onClick={() => setIsMovieModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Tên phim Tiếng Việt *</label>
                          <input
                            type="text"
                            required
                            value={movieForm.titleVi || ''}
                            onChange={e => setMovieForm({ ...movieForm, titleVi: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Tên phim gốc *</label>
                          <input
                            type="text"
                            required
                            value={movieForm.titleOriginal || ''}
                            onChange={e => setMovieForm({ ...movieForm, titleOriginal: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Đạo diễn *</label>
                          <input
                            type="text"
                            required
                            value={movieForm.director || ''}
                            onChange={e => setMovieForm({ ...movieForm, director: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Thời lượng (phút) *</label>
                          <input
                            type="number"
                            min={45}
                            max={300}
                            required
                            value={movieForm.durationMinutes || 120}
                            onChange={e => setMovieForm({ ...movieForm, durationMinutes: Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Phân loại độ tuổi</label>
                          <select
                            value={movieForm.ageRating || 'T13'}
                            onChange={e => setMovieForm({ ...movieForm, ageRating: e.target.value as AgeRating })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                          >
                            <option value="P">P - Mọi lứa tuổi</option>
                            <option value="K">K - Dưới 13 tuổi có giám hộ</option>
                            <option value="T13">T13 - Từ 13 tuổi</option>
                            <option value="T16">T16 - Từ 16 tuổi</option>
                            <option value="T18">T18 - Từ 18 tuổi</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái phát hành</label>
                          <select
                            value={movieForm.status || 'NOW_SHOWING'}
                            onChange={e => setMovieForm({ ...movieForm, status: e.target.value as MovieStatus })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                          >
                            <option value="NOW_SHOWING">Đang chiếu</option>
                            <option value="COMING_SOON">Sắp chiếu</option>
                            <option value="ENDED">Ngừng chiếu</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-700 mb-1">Diễn viên chính</label>
                          <input
                            type="text"
                            value={movieForm.cast || ''}
                            onChange={e => setMovieForm({ ...movieForm, cast: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-700 mb-1">Tóm tắt nội dung</label>
                          <textarea
                            rows={3}
                            value={movieForm.synopsis || ''}
                            onChange={e => setMovieForm({ ...movieForm, synopsis: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => setIsMovieModalOpen(false)}
                          className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
                        >
                          Lưu thông tin phim
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'auditoriums' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900">Quản Lý Cụm Rạp & Cấu Hình Sơ Đồ Phòng Chiếu</h1>
                  <p className="text-sm text-slate-500">
                    Thiết lập loại ghế (Thường, VIP, Ghế đôi, Không sử dụng) và bảo vệ cấu trúc phòng khi đã có vé phát sinh
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cinemas.map(cin => (
                    <div key={cin.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-red-600">{cin.code} • {cin.city}</span>
                        <h3 className="text-lg font-bold text-slate-900 mt-0.5">{cin.name}</h3>
                        <p className="text-xs text-slate-600 mt-1">{cin.address}</p>
                        <p className="text-xs text-slate-500 mt-1">Hotline: {cin.phone} • Giờ mở cửa: {cin.openingHours}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        Đang hoạt động
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-xs font-bold uppercase text-slate-500">Chọn phòng chiếu:</label>
                      <select
                        value={selectedAuditoriumId}
                        onChange={e => setSelectedAuditoriumId(e.target.value)}
                        className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                      >
                        {auditoriums.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({cinemas.find(c => c.id === a.cinemaId)?.name}) — {a.capacity} ghế
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-600 mr-1">Công cụ đổi loại ghế (Click vào ghế để áp dụng):</span>
                      {(['STANDARD', 'VIP', 'COUPLE', 'DISABLED'] as SeatCategory[]).map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSeatBrushType(cat)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                            seatBrushType === cat
                              ? 'bg-red-600 text-white border-red-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {cat === 'STANDARD' && 'Ghế Thường'}
                          {cat === 'VIP' && 'Ghế VIP'}
                          {cat === 'COUPLE' && 'Ghế Đôi'}
                          {cat === 'DISABLED' && 'Khóa bảo trì'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const aud = auditoriums.find(a => a.id === selectedAuditoriumId) || auditoriums[0];
                    return (
                      <div className="flex flex-col items-center bg-zinc-950 p-6 rounded-2xl text-white">
                        <div className="text-xs text-zinc-400 mb-4">
                          Đang cấu hình: <strong className="text-white">{aud.name}</strong> ({aud.rowCount} hàng × {aud.colCount} cột)
                        </div>
                        <div className="space-y-2">
                          {Array.from(new Set(aud.seats.map(s => s.rowLabel))).map(rowLabel => (
                            <div key={rowLabel} className="flex items-center gap-2">
                              <span className="w-6 text-xs font-bold text-zinc-400 text-center">{rowLabel}</span>
                              <div className="flex gap-1.5">
                                {aud.seats
                                  .filter(s => s.rowLabel === rowLabel)
                                  .map(seat => (
                                    <button
                                      key={seat.seatCode}
                                      onClick={() => handlePaintAuditoriumSeat(aud.id, seat.seatCode)}
                                      className={`h-8 w-9 rounded text-[11px] font-bold border transition ${
                                        seat.category === 'DISABLED'
                                          ? 'bg-zinc-900 text-zinc-600 border-zinc-800'
                                          : seat.category === 'VIP'
                                          ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                                          : seat.category === 'COUPLE'
                                          ? 'bg-pink-500/20 text-pink-300 border-pink-500'
                                          : 'bg-zinc-800 text-zinc-200 border-zinc-600'
                                      }`}
                                    >
                                      {seat.seatCode}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {activeTab === 'showtimes' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">Quản Lý Lịch Chiếu & Kiểm Tra Xung Đột</h1>
                    <p className="text-sm text-slate-500">
                      Tự động cộng thời lượng phim + {cleaningBufferMins} phút vệ sinh phòng và chặn trùng giờ chiếu trong cùng phòng
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 text-xs">
                      <span className="font-bold text-slate-600">Phút dọn phòng:</span>
                      <input
                        type="number"
                        min={10}
                        max={60}
                        value={cleaningBufferMins}
                        onChange={e => setCleaningBufferMins(Number(e.target.value))}
                        className="w-12 font-bold text-red-600 text-center outline-none"
                      />
                    </div>
                    <button
                      onClick={() => setIsShowtimeModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Tạo Suất Chiếu Mới
                    </button>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3">
                  <select
                    value={showtimeCinemaFilter}
                    onChange={e => setShowtimeCinemaFilter(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                  >
                    <option value="ALL">Tất cả cụm rạp</option>
                    {cinemas.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <select
                    value={showtimeDateFilter}
                    onChange={e => setShowtimeDateFilter(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                  >
                    <option value="ALL">Tất cả các ngày</option>
                    <option value="2026-10-16">Hôm nay (16/10/2026)</option>
                    <option value="2026-10-17">Ngày mai (17/10/2026)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {showtimes
                    .filter(s => (showtimeCinemaFilter === 'ALL' || s.cinemaId === showtimeCinemaFilter) && (showtimeDateFilter === 'ALL' || s.showDate === showtimeDateFilter))
                    .map(st => {
                      const mv = movies.find(m => m.id === st.movieId);
                      const aud = auditoriums.find(a => a.id === st.auditoriumId);
                      const cin = cinemas.find(c => c.id === st.cinemaId);
                      return (
                        <div key={st.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 text-xs font-extrabold">
                                {st.showDate} • {st.startTime} → {st.endTime}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-bold">
                                {st.format}
                              </span>
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900">{mv?.titleVi}</h3>
                            <p className="text-xs text-slate-500">
                              {cin?.name} • <strong>{aud?.name}</strong> • Giá cơ bản: <strong className="text-slate-900">{formatVND(st.basePrice)}</strong>
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              st.status === 'OPEN_FOR_SALE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {st.status === 'OPEN_FOR_SALE' ? 'Đang mở bán' : 'Đã hủy'}
                            </span>
                            <div className="flex gap-2">
                              {st.status === 'OPEN_FOR_SALE' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedShowtimeId(st.id);
                                      setActiveTab('pos');
                                    }}
                                    className="px-3 py-1 rounded-lg bg-zinc-900 text-white text-xs font-semibold"
                                  >
                                    Sơ đồ ghế
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!assertPermission('showtimes:write')) return;
                                      setShowtimes(prev => prev.map(x => (x.id === st.id ? { ...x, status: 'CANCELLED' } : x)));
                                      appendAuditLog('CANCEL_SHOWTIME', st.id, `Hủy suất chiếu ${st.id} (${mv?.titleVi})`);
                                      showNotification('info', 'Đã hủy suất chiếu', 'Suất chiếu đã đóng và khóa chức năng bán vé.');
                                    }}
                                    className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                                  >
                                    Hủy suất
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {isShowtimeModalOpen && (
                  <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <form
                      onSubmit={handleCreateShowtime}
                      className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <h3 className="text-lg font-extrabold text-slate-900">Tạo Suất Chiếu Mới (Có Kiểm Tra Trùng Lịch)</h3>
                        <button type="button" onClick={() => setIsShowtimeModalOpen(false)} className="text-slate-400">
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Phim Chiếu</label>
                          <select
                            value={newShowtimeForm.movieId}
                            onChange={e => setNewShowtimeForm({ ...newShowtimeForm, movieId: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                          >
                            {movies.filter(m => m.status !== 'ENDED').map(m => (
                              <option key={m.id} value={m.id}>{m.titleVi} ({m.durationMinutes} phút)</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Phòng Chiếu</label>
                          <select
                            value={newShowtimeForm.auditoriumId}
                            onChange={e => setNewShowtimeForm({ ...newShowtimeForm, auditoriumId: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                          >
                            {auditoriums.map(a => (
                              <option key={a.id} value={a.id}>{a.name} ({cinemas.find(c => c.id === a.cinemaId)?.name})</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Ngày chiếu</label>
                            <input
                              type="date"
                              value={newShowtimeForm.showDate}
                              onChange={e => setNewShowtimeForm({ ...newShowtimeForm, showDate: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Giờ bắt đầu (HH:mm)</label>
                            <input
                              type="time"
                              value={newShowtimeForm.startTime}
                              onChange={e => setNewShowtimeForm({ ...newShowtimeForm, startTime: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Định dạng</label>
                            <select
                              value={newShowtimeForm.format}
                              onChange={e => setNewShowtimeForm({ ...newShowtimeForm, format: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                            >
                              <option value="IMAX Laser">IMAX Laser</option>
                              <option value="3D Dolby">3D Dolby</option>
                              <option value="2D Standard">2D Standard</option>
                              <option value="Gold Class">Gold Class</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Giá vé cơ bản (VNĐ)</label>
                            <input
                              type="number"
                              step={5000}
                              min={45000}
                              value={newShowtimeForm.basePrice}
                              onChange={e => setNewShowtimeForm({ ...newShowtimeForm, basePrice: Number(e.target.value) })}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300"
                            />
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                          Giờ kết thúc dự kiến (gồm thời lượng phim + {cleaningBufferMins} phút vệ sinh):{' '}
                          <strong className="text-red-600">
                            {addMinutesToTime(
                              newShowtimeForm.startTime,
                              (movies.find(m => m.id === newShowtimeForm.movieId)?.durationMinutes || 120) + cleaningBufferMins
                            )}
                          </strong>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                        <button type="button" onClick={() => setIsShowtimeModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold">
                          Hủy
                        </button>
                        <button type="submit" className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold">
                          Kiểm tra xung đột & Tạo lịch
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'bookings' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">Quản Lý Đơn Đặt Vé & Đối Soát Thanh Toán</h1>
                    <p className="text-sm text-slate-500">
                      Tra cứu vé điện tử, xác nhận callback cổng thanh toán (chống lặp Idempotency) và hoàn tiền theo quy trình
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={e => setOrderSearch(e.target.value)}
                      placeholder="Tìm theo mã đơn (ORD-...), tên khách hàng, số điện thoại..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <select
                    value={orderStatusFilter}
                    onChange={e => setOrderStatusFilter(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                  >
                    <option value="ALL">Tất cả trạng thái đơn</option>
                    <option value="PAID">Đã thanh toán</option>
                    <option value="PENDING">Chờ thanh toán</option>
                    <option value="REFUNDED">Đã hoàn tiền</option>
                    <option value="CANCELLED">Đã hủy</option>
                  </select>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                          <th className="py-3 px-4">Mã đơn / Thời gian</th>
                          <th className="py-3 px-3">Khách hàng</th>
                          <th className="py-3 px-3">Phim & Phòng</th>
                          <th className="py-3 px-3">Ghế</th>
                          <th className="py-3 px-3 text-right">Tổng tiền</th>
                          <th className="py-3 px-3">Phương thức</th>
                          <th className="py-3 px-3 text-center">Trạng thái</th>
                          <th className="py-3 px-4 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bookings
                          .filter(b => {
                            const matchQ =
                              b.bookingCode.toLowerCase().includes(orderSearch.toLowerCase()) ||
                              b.customerName.toLowerCase().includes(orderSearch.toLowerCase()) ||
                              b.customerPhone.includes(orderSearch);
                            const matchStatus = orderStatusFilter === 'ALL' || b.paymentStatus === orderStatusFilter;
                            return matchQ && matchStatus;
                          })
                          .map(bk => {
                            const mv = movies.find(m => m.id === bk.movieId);
                            const aud = auditoriums.find(a => a.id === bk.auditoriumId);
                            return (
                              <tr key={bk.id} className="hover:bg-slate-50">
                                <td className="py-3 px-4">
                                  <div className="font-mono font-bold text-red-600 text-xs">{bk.bookingCode}</div>
                                  <div className="text-[11px] text-slate-500">{formatDateTimeVN(bk.createdAt)}</div>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="font-bold text-slate-900">{bk.customerName}</div>
                                  <div className="text-xs text-slate-500">{bk.customerPhone}</div>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="font-semibold text-slate-800">{mv?.titleVi}</div>
                                  <div className="text-xs text-slate-500">{aud?.name}</div>
                                </td>
                                <td className="py-3 px-3 font-bold text-slate-700 text-xs">
                                  {bk.seats.map(s => s.seatCode).join(', ')}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div className="font-extrabold text-slate-900">{formatVND(bk.finalAmount)}</div>
                                  {bk.discountAmount > 0 && (
                                    <div className="text-[11px] text-emerald-600">Giảm: -{formatVND(bk.discountAmount)}</div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-xs font-semibold text-slate-600">
                                  {bk.paymentMethod}
                                  <div className="text-[10px] font-mono text-slate-400">{bk.transactionRef}</div>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                    bk.paymentStatus === 'PAID'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : bk.paymentStatus === 'PENDING'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-rose-100 text-rose-700'
                                  }`}>
                                    {bk.paymentStatus === 'PAID' && 'Đã thanh toán'}
                                    {bk.paymentStatus === 'PENDING' && 'Chờ thanh toán'}
                                    {bk.paymentStatus === 'REFUNDED' && 'Đã hoàn tiền'}
                                    {bk.paymentStatus === 'CANCELLED' && 'Đã hủy'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      onClick={() => setActiveTicketModal(bk)}
                                      className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700"
                                    >
                                      Vé QR
                                    </button>
                                    {bk.paymentStatus === 'PENDING' && (
                                      <button
                                        onClick={() => handleConfirmPendingOrder(bk)}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                                      >
                                        Xác nhận TT
                                      </button>
                                    )}
                                    {(bk.paymentStatus === 'PAID' || bk.paymentStatus === 'PENDING') && (
                                      <button
                                        onClick={() => handleRefundBooking(bk)}
                                        className="px-2.5 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold"
                                      >
                                        Hoàn/Hủy
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900">Quản Lý Khách Hàng & Điểm Thành Viên (Loyalty)</h1>
                  <p className="text-sm text-slate-500">
                    Theo dõi hạng thẻ (Member, Silver, Gold, Diamond), tổng chi tiêu và khóa/mở khóa tài khoản theo quyền hạn
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="Tìm khách hàng theo họ tên, email hoặc số điện thoại..."
                    className="w-full max-w-md px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                        <th className="py-3 px-4">Mã KH / Họ tên</th>
                        <th className="py-3 px-3">Liên hệ</th>
                        <th className="py-3 px-3">Hạng thẻ</th>
                        <th className="py-3 px-3 text-right">Điểm tích lũy</th>
                        <th className="py-3 px-3 text-right">Tổng vé</th>
                        <th className="py-3 px-3 text-right">Tổng chi tiêu</th>
                        <th className="py-3 px-3 text-center">Trạng thái</th>
                        <th className="py-3 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customers
                        .filter(
                          c =>
                            c.fullName.toLowerCase().includes(customerSearch.toLowerCase()) ||
                            c.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
                            c.phone.includes(customerSearch)
                        )
                        .map(cus => (
                          <tr key={cus.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <div className="text-xs font-mono text-slate-400">{cus.code}</div>
                              <div className="font-bold text-slate-900">{cus.fullName}</div>
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-600">
                              <div>{cus.phone}</div>
                              <div>{cus.email}</div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                cus.tier === 'DIAMOND'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : cus.tier === 'GOLD'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {cus.tier}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-red-600">{cus.loyaltyPoints} điểm</td>
                            <td className="py-3 px-3 text-right font-semibold">{cus.totalTickets} vé</td>
                            <td className="py-3 px-3 text-right font-bold text-slate-900">{formatVND(cus.totalSpent)}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                cus.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {cus.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  if (!assertPermission('customers:write')) return;
                                  const next = cus.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
                                  setCustomers(prev => prev.map(x => (x.id === cus.id ? { ...x, status: next } : x)));
                                  appendAuditLog('TOGGLE_CUSTOMER_STATUS', cus.code, `Chuyển trạng thái khách hàng ${cus.fullName} sang ${next}`);
                                  showNotification('info', 'Đã cập nhật trạng thái', `Tài khoản ${cus.fullName} đã chuyển sang ${next}.`);
                                }}
                                className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold"
                              >
                                {cus.status === 'ACTIVE' ? 'Khóa TK' : 'Mở khóa'}
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'promotions' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">Quản Lý Chương Trình Khuyến Mãi & Voucher</h1>
                    <p className="text-sm text-slate-500">
                      Kiểm tra điều kiện đơn hàng tối thiểu, mức giảm tối đa, hạn sử dụng và số lượt dùng tại Backend
                    </p>
                  </div>
                  <button
                    onClick={() => setIsPromoModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
                  >
                    <Plus className="w-4 h-4" /> Tạo Mã Khuyến Mãi
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {promotions.map(prm => (
                    <div key={prm.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 rounded-lg bg-red-50 text-red-600 font-mono font-extrabold text-sm border border-red-200">
                            {prm.code}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            prm.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {prm.isActive ? 'Đang chạy' : 'Ngừng / Hết hạn'}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 mt-3">{prm.name}</h3>
                        <p className="text-xs text-slate-500 mt-1">{prm.description}</p>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 pt-3 border-t border-slate-100">
                        <div>
                          Mức giảm:{' '}
                          <strong className="text-slate-900">
                            {prm.discountType === 'PERCENTAGE' ? `${prm.discountValue}%` : formatVND(prm.discountValue)}
                          </strong>{' '}
                          (Tối đa: {formatVND(prm.maxDiscountAmount)})
                        </div>
                        <div>Đơn tối thiểu: <strong>{formatVND(prm.minOrderAmount)}</strong></div>
                        <div>Thời hạn: {prm.startDate} → {prm.endDate}</div>
                        <div className="flex items-center justify-between pt-2">
                          <span>Lượt dùng: <strong>{prm.usedCount} / {prm.usageLimit}</strong></span>
                          <button
                            onClick={() => {
                              setPromotions(prev => prev.map(x => (x.id === prm.id ? { ...x, isActive: !x.isActive } : x)));
                              appendAuditLog('TOGGLE_PROMO', prm.code, `Đổi trạng thái mã khuyến mãi ${prm.code}`);
                            }}
                            className="text-red-600 font-bold hover:underline"
                          >
                            {prm.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {isPromoModalOpen && (
                  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        if (!newPromoForm.code.trim() || !newPromoForm.name.trim()) return;
                        const created: Promotion = {
                          id: `prm-${Date.now()}`,
                          code: newPromoForm.code.trim().toUpperCase(),
                          name: newPromoForm.name,
                          description: newPromoForm.description,
                          discountType: newPromoForm.discountType,
                          discountValue: Number(newPromoForm.discountValue),
                          maxDiscountAmount: Number(newPromoForm.maxDiscountAmount),
                          minOrderAmount: Number(newPromoForm.minOrderAmount),
                          startDate: newPromoForm.startDate,
                          endDate: newPromoForm.endDate,
                          usageLimit: Number(newPromoForm.usageLimit),
                          usedCount: 0,
                          perCustomerLimit: 1,
                          isActive: true
                        };
                        setPromotions(prev => [created, ...prev]);
                        appendAuditLog('CREATE_PROMOTION', created.code, `Tạo mã khuyến mãi ${created.code}`);
                        setIsPromoModalOpen(false);
                        showNotification('success', 'Đã tạo mã khuyến mãi', `Mã ${created.code} đã sẵn sàng áp dụng.`);
                      }}
                      className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
                    >
                      <h3 className="text-lg font-extrabold text-slate-900">Tạo Chương Trình Khuyến Mãi Mới</h3>
                      <div className="space-y-3 text-sm">
                        <input
                          type="text"
                          required
                          placeholder="Mã Code (VD: TET2027) *"
                          value={newPromoForm.code}
                          onChange={e => setNewPromoForm({ ...newPromoForm, code: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 uppercase"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Tên chương trình *"
                          value={newPromoForm.name}
                          onChange={e => setNewPromoForm({ ...newPromoForm, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={newPromoForm.discountType}
                            onChange={e => setNewPromoForm({ ...newPromoForm, discountType: e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT' })}
                            className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                          >
                            <option value="PERCENTAGE">Giảm theo %</option>
                            <option value="FIXED_AMOUNT">Giảm tiền cố định</option>
                          </select>
                          <input
                            type="number"
                            required
                            placeholder="Giá trị giảm"
                            value={newPromoForm.discountValue}
                            onChange={e => setNewPromoForm({ ...newPromoForm, discountValue: Number(e.target.value) })}
                            className="px-3 py-2 rounded-lg border border-slate-300"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] font-bold text-slate-500">Đơn tối thiểu (VNĐ)</label>
                            <input
                              type="number"
                              value={newPromoForm.minOrderAmount}
                              onChange={e => setNewPromoForm({ ...newPromoForm, minOrderAmount: Number(e.target.value) })}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-500">Giảm tối đa (VNĐ)</label>
                            <input
                              type="number"
                              value={newPromoForm.maxDiscountAmount}
                              onChange={e => setNewPromoForm({ ...newPromoForm, maxDiscountAmount: Number(e.target.value) })}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                        <button type="button" onClick={() => setIsPromoModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
                          Hủy
                        </button>
                        <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold">
                          Tạo mã
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'employees' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">Quản Lý Nhân Viên & Phân Quyền Hệ Thống</h1>
                    <p className="text-sm text-slate-500">
                      Gán nhân sự theo cụm rạp, phân quyền RBAC và lưu trữ mật khẩu băm Bcrypt an toàn
                    </p>
                  </div>
                  {currentRole === 'ADMIN' && (
                    <button
                      onClick={() => setIsStaffModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
                    >
                      <Plus className="w-4 h-4" /> Thêm Tài Khoản Nhân Viên
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                        <th className="py-3 px-4">Mã NV / Họ tên</th>
                        <th className="py-3 px-3">Chức vụ</th>
                        <th className="py-3 px-3">Vai trò RBAC</th>
                        <th className="py-3 px-3">Cụm rạp công tác</th>
                        <th className="py-3 px-3">Băm mật khẩu (Bcrypt)</th>
                        <th className="py-3 px-3 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div className="text-xs font-mono text-slate-400">{emp.code}</div>
                            <div className="font-bold text-slate-900">{emp.fullName}</div>
                            <div className="text-xs text-slate-500">{emp.email}</div>
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-700">{emp.position}</td>
                          <td className="py-3 px-3">
                            <span className="px-2.5 py-1 rounded-md bg-zinc-900 text-white text-xs font-bold">
                              {emp.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-xs font-semibold text-slate-600">
                            {cinemas.find(c => c.id === emp.cinemaId)?.name}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                            {emp.passwordHash.slice(0, 26)}...
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                              {emp.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isStaffModalOpen && (
                  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        if (!assertPermission('employees:write')) return;
                        const created: Employee = {
                          id: `emp-${Date.now()}`,
                          code: `NV-${newStaffForm.role}-${employees.length + 1}`,
                          fullName: newStaffForm.fullName,
                          email: newStaffForm.email,
                          phone: newStaffForm.phone,
                          position: newStaffForm.position,
                          role: newStaffForm.role,
                          cinemaId: newStaffForm.cinemaId,
                          status: 'ACTIVE',
                          passwordHash: `$2b$12$BcryptSaltedHash${Date.now()}`
                        };
                        setEmployees(prev => [...prev, created]);
                        appendAuditLog('CREATE_EMPLOYEE', created.code, `Tạo tài khoản nhân viên ${created.fullName} (${created.role})`);
                        setIsStaffModalOpen(false);
                        showNotification('success', 'Đã tạo nhân viên mới', `Mật khẩu của ${created.fullName} đã được băm Bcrypt an toàn.`);
                      }}
                      className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
                    >
                      <h3 className="text-lg font-extrabold text-slate-900">Tạo Tài Khoản Nhân Viên Mới</h3>
                      <div className="space-y-3 text-sm">
                        <input
                          type="text"
                          required
                          placeholder="Họ và tên nhân viên *"
                          value={newStaffForm.fullName}
                          onChange={e => setNewStaffForm({ ...newStaffForm, fullName: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300"
                        />
                        <input
                          type="email"
                          required
                          placeholder="Email công vụ *"
                          value={newStaffForm.email}
                          onChange={e => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Số điện thoại *"
                          value={newStaffForm.phone}
                          onChange={e => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={newStaffForm.role}
                            onChange={e => setNewStaffForm({ ...newStaffForm, role: e.target.value as RoleCode })}
                            className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                          >
                            <option value="STAFF">STAFF (Nhân viên POS)</option>
                            <option value="MANAGER">MANAGER (Quản lý rạp)</option>
                            <option value="ADMIN">ADMIN (Quản trị viên)</option>
                          </select>
                          <select
                            value={newStaffForm.cinemaId}
                            onChange={e => setNewStaffForm({ ...newStaffForm, cinemaId: e.target.value })}
                            className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                          >
                            {cinemas.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                        <button type="button" onClick={() => setIsStaffModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
                          Hủy
                        </button>
                        <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold">
                          Tạo tài khoản
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">Báo Cáo Tài Chính & Phân Tích Hoạt Động</h1>
                    <p className="text-sm text-slate-500">
                      Quy chuẩn kế toán: Doanh thu thuần = Tổng vé ĐÃ THANH TOÁN trừ Hoàn tiền (Không cộng đơn Chờ thanh toán)
                    </p>
                  </div>
                  <button
                    onClick={handleExportReportCSV}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Xuất Báo Cáo Ra CSV / Excel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 uppercase">Tổng Doanh Thu Gộp (Đã TT)</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{formatVND(analytics.grossPaidRevenue)}</div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 uppercase">Tổng Khoản Hoàn Tiền Vé</div>
                    <div className="text-2xl font-extrabold text-rose-600 mt-1">-{formatVND(analytics.totalRefundedAmount)}</div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-red-200 bg-red-50/30">
                    <div className="text-xs font-bold text-red-700 uppercase">Doanh Thu Thuần Thực Nhận</div>
                    <div className="text-2xl font-extrabold text-red-600 mt-1">{formatVND(analytics.netRevenue)}</div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 uppercase">Đơn Chờ TT (Chưa ghi nhận DT)</div>
                    <div className="text-2xl font-extrabold text-amber-600 mt-1">{formatVND(analytics.pendingRevenue)}</div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <h3 className="font-bold text-slate-900 mb-4">Bảng Kê Chi Tiết Doanh Thu Theo Phim</h3>
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                        <th className="py-3 px-4">Tên bộ phim</th>
                        <th className="py-3 px-3 text-right">Số vé thực bán</th>
                        <th className="py-3 px-3 text-right">Doanh thu thuần (VNĐ)</th>
                        <th className="py-3 px-4 text-right">Tỷ trọng đóng góp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analytics.revenueByMovie.map(row => {
                        const share = analytics.netRevenue > 0 ? ((row.revenue / analytics.netRevenue) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900">{row.fullTitle}</td>
                            <td className="py-3 px-3 text-right font-semibold">{row.tickets} vé</td>
                            <td className="py-3 px-3 text-right font-extrabold text-red-600">{formatVND(row.revenue)}</td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-600">{share}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'audit' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900">Nhật Ký Kiểm Toán & Bảo Mật (Audit Logs)</h1>
                  <p className="text-sm text-slate-500">
                    Ghi nhận toàn bộ thao tác quan trọng (Không lưu mật khẩu, JWT token hoặc thông tin thẻ nhạy cảm)
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                        <th className="py-3 px-4">Thời gian (GMT+7)</th>
                        <th className="py-3 px-3">Người thực hiện</th>
                        <th className="py-3 px-3">Vai trò</th>
                        <th className="py-3 px-3">Hành động</th>
                        <th className="py-3 px-3">Đối tượng</th>
                        <th className="py-3 px-4">Chi tiết kiểm toán</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-xs text-slate-500">{formatDateTimeVN(log.timestamp)}</td>
                          <td className="py-3 px-3 font-bold text-slate-900">{log.actorName}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-xs font-bold">{log.actorRole}</span>
                          </td>
                          <td className="py-3 px-3 font-mono text-xs font-bold text-red-600">{log.action}</td>
                          <td className="py-3 px-3 font-mono text-xs text-slate-700">{log.target}</td>
                          <td className="py-3 px-4 text-xs text-slate-600">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        </div>
      ) : (
        <div className="flex-1 bg-zinc-950 text-zinc-100 flex flex-col">
          <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 px-4 lg:px-10 py-4 flex items-center justify-between">
            <div
              onClick={() => setCustomerView('HOME')}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight text-white">CMS CINEMAS</span>
                <span className="block text-[10px] uppercase tracking-widest text-red-400 font-bold">Trải Nghiệm Điện Ảnh Đỉnh Cao</span>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
              <button
                onClick={() => setCustomerView('HOME')}
                className={customerView === 'HOME' ? 'text-red-500' : 'text-zinc-300 hover:text-white'}
              >
                Trang chủ
              </button>
              <button
                onClick={() => setCustomerView('MOVIES')}
                className={customerView === 'MOVIES' ? 'text-red-500' : 'text-zinc-300 hover:text-white'}
              >
                Phim Đang Chiếu & Sắp Chiếu
              </button>
              <button
                onClick={() => setCustomerView('BOOKING_WIZARD')}
                className={customerView === 'BOOKING_WIZARD' ? 'text-red-500' : 'text-zinc-300 hover:text-white'}
              >
                Đặt Vé Nhanh
              </button>
              <button
                onClick={() => setCustomerView('MY_ACCOUNT')}
                className={customerView === 'MY_ACCOUNT' ? 'text-red-500' : 'text-zinc-300 hover:text-white'}
              >
                Vé Của Tôi & Điểm Thưởng
              </button>
            </nav>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setCustomerView('MY_ACCOUNT')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-white"
              >
                <User className="w-4 h-4 text-red-500" />
                <span>Phạm Quốc Khách Hàng (480 điểm)</span>
              </button>
            </div>
          </header>

          <div className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8">
            {customerView === 'HOME' && (
              <div className="space-y-12">
                <div className="relative rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
                  <img
                    src={HERO_BANNER_IMG}
                    alt="Cinema Hero Banner"
                    className="w-full h-[360px] md:h-[440px] object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent flex flex-col justify-end p-6 md:p-12 max-w-2xl">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-extrabold w-fit mb-3">
                      SUẤT CHIẾU ĐẶC BIỆT IMAX LASER
                    </span>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                      Chân Trời Sự Kiện: Kỷ Nguyên Đỏ
                    </h1>
                    <p className="text-sm text-zinc-300 mt-3 line-clamp-2">
                      Bom tấn khoa học viễn tưởng hoành tráng nhất năm 2026. Trải nghiệm âm thanh vòm Dolby Atmos và màn hình cong cực đại tại cụm rạp CMS.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-6">
                      <button
                        onClick={() => {
                          setSelectedMovieDetail(movies[0]);
                          setSelectedShowtimeId('st-01');
                          setCustomerView('BOOKING_WIZARD');
                        }}
                        className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/30 flex items-center gap-2"
                      >
                        <Ticket className="w-4 h-4" /> Đặt Vé Ngay
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMovieDetail(movies[0]);
                          setCustomerView('MOVIE_DETAIL');
                        }}
                        className="px-5 py-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-white font-semibold text-sm border border-zinc-700"
                      >
                        Xem Chi Tiết & Lịch Chiếu
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-extrabold text-white">Phim Đang Khởi Chiếu</h2>
                      <p className="text-xs text-zinc-400 mt-0.5">Chọn phim yêu thích để xem suất chiếu và chọn ghế trực tuyến</p>
                    </div>
                    <button
                      onClick={() => setCustomerView('MOVIES')}
                      className="text-sm font-bold text-red-500 hover:text-red-400 flex items-center gap-1"
                    >
                      Xem tất cả ({movies.length} phim) <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {movies.filter(m => m.status === 'NOW_SHOWING').slice(0, 4).map(movie => (
                      <div
                        key={movie.id}
                        className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden flex flex-col justify-between group hover:border-red-500/60 transition"
                      >
                        <div>
                          <div className="relative h-72 overflow-hidden">
                            <img
                              src={movie.posterUrl}
                              alt={movie.titleVi}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                            />
                            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-extrabold">
                              {movie.ageRating}
                            </span>
                            <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-black/80 text-zinc-200 text-xs font-semibold">
                              {movie.durationMinutes} phút
                            </span>
                          </div>
                          <div className="p-4">
                            <div className="text-xs text-red-400 font-semibold">{movie.genres.join(' • ')}</div>
                            <h3 className="font-bold text-white text-base mt-1 line-clamp-1">{movie.titleVi}</h3>
                            <p className="text-xs text-zinc-400 mt-0.5">{movie.titleOriginal}</p>
                          </div>
                        </div>

                        <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setSelectedMovieDetail(movie);
                              setCustomerView('MOVIE_DETAIL');
                            }}
                            className="py-2 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-200"
                          >
                            Chi tiết
                          </button>
                          <button
                            onClick={() => {
                              const st = showtimes.find(s => s.movieId === movie.id && s.status === 'OPEN_FOR_SALE');
                              if (st) setSelectedShowtimeId(st.id);
                              setCustomerView('BOOKING_WIZARD');
                            }}
                            className="py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white"
                          >
                            Đặt vé
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
                  <h3 className="text-lg font-extrabold text-white mb-4">Ưu Đãi & Mã Khuyến Mãi Đang Áp Dụng</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {promotions.filter(p => p.isActive).map(p => (
                      <div key={p.id} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-4">
                        <div>
                          <span className="px-2.5 py-1 rounded bg-red-600/20 text-red-400 font-mono text-xs font-bold border border-red-500/30">
                            {p.code}
                          </span>
                          <div className="font-bold text-white mt-2">{p.name}</div>
                          <div className="text-xs text-zinc-400 mt-0.5">{p.description}</div>
                        </div>
                        <button
                          onClick={() => {
                            setBookingPromoInput(p.code);
                            setCustomerView('BOOKING_WIZARD');
                            showNotification('info', `Đã điền sẵn mã ${p.code}`, 'Hãy chọn ghế và bấm Áp dụng trong bước thanh toán.');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shrink-0"
                        >
                          Dùng ngay
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {customerView === 'MOVIES' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-extrabold text-white">Danh Sách Phim Tại Cụm Rạp CMS</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {movies.map(movie => (
                    <div key={movie.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden flex flex-col justify-between">
                      <div>
                        <img src={movie.posterUrl} alt={movie.titleVi} className="w-full h-64 object-cover" />
                        <div className="p-4">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-600 text-white mr-2">{movie.ageRating}</span>
                          <span className="text-xs text-zinc-400">{movie.durationMinutes} phút</span>
                          <h3 className="font-bold text-white mt-2">{movie.titleVi}</h3>
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{movie.synopsis}</p>
                        </div>
                      </div>
                      <div className="p-4 pt-0">
                        <button
                          onClick={() => {
                            setSelectedMovieDetail(movie);
                            setCustomerView('MOVIE_DETAIL');
                          }}
                          className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                        >
                          Xem Lịch Chiếu & Đặt Vé
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {customerView === 'MOVIE_DETAIL' && (
              <div className="space-y-8">
                <button
                  onClick={() => setCustomerView('HOME')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" /> Quay lại Trang chủ
                </button>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
                  <div className="md:col-span-4">
                    <img
                      src={selectedMovieDetail.posterUrl}
                      alt={selectedMovieDetail.titleVi}
                      className="w-full rounded-2xl border border-zinc-700 object-cover max-h-[420px]"
                    />
                  </div>
                  <div className="md:col-span-8 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-md bg-red-600 text-white text-xs font-extrabold">
                        Phân loại: {selectedMovieDetail.ageRating}
                      </span>
                      <span className="px-3 py-1 rounded-md bg-zinc-800 text-zinc-200 text-xs font-semibold">
                        {selectedMovieDetail.durationMinutes} phút
                      </span>
                      <span className="px-3 py-1 rounded-md bg-zinc-800 text-zinc-200 text-xs font-semibold">
                        {selectedMovieDetail.language}
                      </span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-white">{selectedMovieDetail.titleVi}</h1>
                    <p className="text-sm text-zinc-400 italic">{selectedMovieDetail.titleOriginal}</p>
                    <p className="text-sm text-zinc-200 leading-relaxed">{selectedMovieDetail.synopsis}</p>
                    <div className="text-xs text-zinc-300 space-y-1 pt-2 border-t border-zinc-800">
                      <div><strong>Đạo diễn:</strong> {selectedMovieDetail.director}</div>
                      <div><strong>Diễn viên:</strong> {selectedMovieDetail.cast}</div>
                      <div><strong>Thể loại:</strong> {selectedMovieDetail.genres.join(', ')}</div>
                    </div>

                    <div className="pt-4">
                      <h3 className="text-sm font-bold text-white mb-3">Chọn Suất Chiếu Còn Hiệu Lực:</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {showtimes
                          .filter(s => s.movieId === selectedMovieDetail.id && s.status === 'OPEN_FOR_SALE')
                          .map(st => {
                            const cin = cinemas.find(c => c.id === st.cinemaId);
                            const aud = auditoriums.find(a => a.id === st.auditoriumId);
                            return (
                              <button
                                key={st.id}
                                onClick={() => {
                                  setSelectedShowtimeId(st.id);
                                  setSelectedSeats([]);
                                  setCustomerView('BOOKING_WIZARD');
                                }}
                                className="p-3.5 rounded-xl bg-zinc-950 hover:bg-red-600/20 border border-zinc-800 hover:border-red-500 text-left transition"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-base font-extrabold text-white">{st.startTime}</span>
                                  <span className="text-xs font-bold text-red-400">{formatVND(st.basePrice)}</span>
                                </div>
                                <div className="text-xs text-zinc-400 mt-1">{cin?.name}</div>
                                <div className="text-[11px] text-zinc-500">{aud?.name} • {st.showDate}</div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {customerView === 'BOOKING_WIZARD' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-extrabold text-white">Đặt Vé Trực Tuyến & Chọn Ghế</h2>
                    <p className="text-xs text-zinc-400">Chọn suất chiếu, chọn ghế trên sơ đồ phòng và nhận vé QR ngay lập tức</p>
                  </div>
                  <select
                    value={selectedShowtimeId}
                    onChange={e => {
                      setSelectedShowtimeId(e.target.value);
                      setSelectedSeats([]);
                    }}
                    className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm font-bold text-white"
                  >
                    {showtimes.filter(s => s.status === 'OPEN_FOR_SALE').map(st => {
                      const mv = movies.find(m => m.id === st.movieId);
                      const cin = cinemas.find(c => c.id === st.cinemaId);
                      return (
                        <option key={st.id} value={st.id}>
                          [{st.showDate} {st.startTime}] {mv?.titleVi} — {cin?.name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8 bg-zinc-900 p-6 rounded-2xl border border-zinc-800 flex flex-col items-center">
                    <div className="w-full max-w-lg mb-8 text-center">
                      <div className="h-2.5 w-full bg-gradient-to-r from-transparent via-red-500 to-transparent rounded-t-full shadow-[0_10px_25px_rgba(239,68,68,0.6)]" />
                      <span className="text-[11px] uppercase tracking-widest text-zinc-400 block mt-2">
                        MÀN HÌNH ({selectedAuditorium?.name})
                      </span>
                    </div>

                    <div className="space-y-2">
                      {Array.from(new Set(selectedAuditorium.seats.map(s => s.rowLabel))).map(rowLabel => (
                        <div key={rowLabel} className="flex items-center gap-2">
                          <span className="w-5 text-xs font-bold text-zinc-500">{rowLabel}</span>
                          <div className="flex gap-1.5">
                            {selectedAuditorium.seats
                              .filter(s => s.rowLabel === rowLabel)
                              .map(seat => {
                                const isSold = soldSeatCodesForShowtime.has(seat.seatCode);
                                const isHeldOther = heldByOtherSeatCodes.has(seat.seatCode);
                                const isSelected = selectedSeats.includes(seat.seatCode);
                                return (
                                  <button
                                    key={seat.seatCode}
                                    onClick={() => handleToggleSeat(seat)}
                                    className={`h-8 w-8 rounded-t-lg text-[11px] font-bold border transition ${
                                      isSold
                                        ? 'bg-red-600 text-white border-red-500 cursor-not-allowed'
                                        : isHeldOther
                                        ? 'bg-amber-500 text-zinc-950 border-amber-400 cursor-not-allowed'
                                        : isSelected
                                        ? 'bg-sky-600 text-white border-sky-400'
                                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                                    }`}
                                  >
                                    {seat.seatCode}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-4 bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4">
                    <h3 className="text-lg font-extrabold text-white">{selectedMovieForShowtime?.titleVi}</h3>
                    <div className="text-xs text-zinc-400">
                      Ghế đã chọn: <strong className="text-sky-400">{selectedSeats.join(', ') || 'Chưa chọn'}</strong>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={bookingPromoInput}
                        onChange={e => setBookingPromoInput(e.target.value)}
                        placeholder="Mã khuyến mãi (VD: CMSWELCOME20)"
                        className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white uppercase"
                      />
                      <button
                        onClick={handleApplyPromoCode}
                        className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold"
                      >
                        Áp mã
                      </button>
                    </div>

                    <div className="space-y-1 text-sm pt-3 border-t border-zinc-800">
                      <div className="flex justify-between text-zinc-400">
                        <span>Tạm tính:</span>
                        <span>{formatVND(bookingPricing.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400">
                        <span>Giảm giá:</span>
                        <span>-{formatVND(bookingPricing.discount)}</span>
                      </div>
                      <div className="flex justify-between text-base font-extrabold text-white pt-2">
                        <span>Thành tiền:</span>
                        <span className="text-red-500">{formatVND(bookingPricing.finalTotal)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleConfirmBooking(true)}
                      className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/30"
                    >
                      Thanh Toán & Nhận Vé Điện Tử QR
                    </button>
                  </div>
                </div>
              </div>
            )}

            {customerView === 'MY_ACCOUNT' && (
              <div className="space-y-6">
                <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs uppercase font-bold text-amber-400">Hạng Thẻ GOLD MEMBER</span>
                    <h2 className="text-2xl font-extrabold text-white mt-0.5">Phạm Quốc Khách Hàng</h2>
                    <p className="text-xs text-zinc-400 mt-1">Email: khachhang@gmail.com • SĐT: 0909123456</p>
                  </div>
                  <div className="flex gap-6">
                    <div className="text-right">
                      <span className="text-xs text-zinc-400 block">Điểm tích lũy</span>
                      <span className="text-2xl font-extrabold text-red-500">
                        {customers.find(c => c.id === 'cus-01')?.loyaltyPoints || 480} điểm
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-zinc-400 block">Tổng chi tiêu</span>
                      <span className="text-2xl font-extrabold text-white">
                        {formatVND(customers.find(c => c.id === 'cus-01')?.totalSpent || 1120000)}
                      </span>
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-extrabold text-white">Lịch Sử Đặt Vé & Vé Điện Tử Của Bạn</h3>
                <div className="space-y-3">
                  {bookings.map(bk => {
                    const mv = movies.find(m => m.id === bk.movieId);
                    return (
                      <div key={bk.id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <span className="font-mono text-xs font-bold text-red-400">{bk.bookingCode}</span>
                          <h4 className="font-bold text-white text-base">{mv?.titleVi}</h4>
                          <p className="text-xs text-zinc-400">
                            Ghế: {bk.seats.map(s => s.seatCode).join(', ')} • Tổng: {formatVND(bk.finalAmount)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-200">
                            {bk.paymentStatus}
                          </span>
                          <button
                            onClick={() => setActiveTicketModal(bk)}
                            className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5"
                          >
                            <QrCode className="w-4 h-4" /> Mở Vé QR
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
