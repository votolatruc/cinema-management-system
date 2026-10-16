# Cinema Management System (CMS) - Hệ Thống Quản Lý Cụm Rạp Chiếu Phim & Đặt Vé

Hệ thống quản lý cụm rạp chiếu phim toàn diện (**Cinema Management System - CMS**) hỗ trợ cả **Cổng Quản Trị Nội Bộ (Admin / Manager / Staff POS)** và **Website Đặt Vé Dành Cho Khách Hàng (Customer Portal)** với ngôn ngữ Tiếng Việt, định dạng tiền tệ VNĐ và múi giờ `Asia/Ho_Chi_Minh`.

---

## 1. Kiến Trúc Tổng Thể & Công Nghệ Sử Dụng

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide Icons, Recharts, React Hook Form + Zod.
- **Backend**: Node.js, Express.js, TypeScript, RESTful API, OpenAPI/Swagger (`docs/openapi.yaml`).
- **Database & ORM**: PostgreSQL + Prisma ORM (`database/prisma/schema.prisma`), hỗ trợ khóa giao dịch `Serializable` chống bán trùng ghế và kiểu `Decimal(14, 0)` cho tiền tệ VNĐ.
- **Bảo mật & Phân quyền**: RBAC 4 vai trò (`ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER`) kiểm tra đồng thời tại cả UI và API Middleware (`authenticateJWT`, `requireRoles`, `enforceCinemaScope`).

---

## 2. Tài Khoản Demo (Chỉ dùng cho môi trường Development)

> **Lưu ý bảo mật**: Các tài khoản dưới đây chỉ phục vụ môi trường phát triển/demo. Tuyệt đối không sử dụng mật khẩu mặc định trên môi trường Production.

| Vai trò | Họ và tên | Email đăng nhập | Mật khẩu Demo | Phạm vi quyền hạn |
| :--- | :--- | :--- | :--- | :--- |
| **Admin (Quản trị viên)** | Nguyễn Hoàng Quản Trị | `admin@cinemacms.vn` | `Admin@2026!` | Toàn quyền hệ thống, cấu hình cụm rạp, nhân sự, nhật ký kiểm toán |
| **Manager (Quản lý rạp)** | Trần Minh Quản Lý | `manager.sg@cinemacms.vn` | `Manager@2026!` | Quản lý phim, phòng chiếu, lịch chiếu, khuyến mãi, báo cáo tại cụm rạp |
| **Staff (Nhân viên quầy)** | Lê Thu Nhân Viên | `staff.sg@cinemacms.vn` | `Staff@2026!` | Bán vé tại quầy (POS), giữ ghế, thu tiền mặt/VietQR, in vé QR & soát vé |
| **Customer (Khách hàng)** | Phạm Quốc Khách Hàng | `khachhang@gmail.com` | `Customer@2026!` | Đặt vé trực tuyến, áp mã khuyến mãi, xem vé QR điện tử, tích điểm thành viên |

---

## 3. Hướng Dẫn Cài Đặt & Chạy Dự Án (Local Development)

### Bước 1: Chuẩn bị biến môi trường
```bash
cp .env.example .env
```

### Bước 2: Khởi tạo PostgreSQL & Prisma Migration + Seed Data
```bash
cd database
npm install
npx prisma migrate dev --name init
npx prisma db seed
```

### Bước 3: Khởi chạy Backend API & Kiểm thử
```bash
cd ../backend
npm install
npm run test        # Chạy bộ kiểm thử Vitest cho 13 nghiệp vụ quan trọng
npm run dev         # Khởi chạy RESTful API tại http://localhost:4000
```

### Bước 4: Khởi chạy Frontend React Vite
```bash
cd ../frontend
npm install
npm run dev         # Mở trình duyệt tại http://localhost:5173
```

---

## 4. Hướng Dẫn Triển Khai Production

1. **Biến môi trường & Bảo mật**:
   - Đặt `NODE_ENV=production` và `PAYMENT_MODE=PRODUCTION`.
   - Sinh khóa ngẫu nhiên tối thiểu 64 ký tự hex cho `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` và `PAYMENT_WEBHOOK_SECRET`.
   - Xóa hoặc khóa toàn bộ tài khoản seed demo trước khi mở cổng truy cập công khai.
2. **Cơ sở dữ liệu PostgreSQL**:
   - Bật kết nối SSL (`?sslmode=require`), thiết lập PgBouncer connection pooling và cấu hình cronjob `pg_dump` sao lưu tự động hằng ngày.
   - Chạy `npx prisma migrate deploy` trong pipeline CI/CD.
3. **Cổng thanh toán**:
   - Khai báo `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` và cấu hình IPN Webhook trỏ về `POST /api/payments/webhook` có kiểm tra chữ ký HMAC-SHA256 và chống xử lý lặp qua `idempotency_key`.
