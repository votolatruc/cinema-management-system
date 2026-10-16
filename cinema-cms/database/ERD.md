# Sơ Đồ Thực Thể Liên Kết (ERD) - Cinema Management System (CMS)

## 1. Sơ đồ ERD (Mermaid Diagram)

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : assigned_to
    ROLES ||--o{ ROLE_PERMISSIONS : grants
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : included_in
    USERS ||--o| CUSTOMERS : profile
    USERS ||--o| EMPLOYEES : staff_profile
    USERS ||--o{ AUDIT_LOGS : performs

    CINEMAS ||--o{ AUDITORIUMS : contains
    CINEMAS ||--o{ EMPLOYEES : employs
    AUDITORIUMS ||--o{ SEATS : has_layout
    SEAT_TYPES ||--o{ SEATS : classifies

    MOVIES ||--o{ MOVIE_GENRES : categorized_as
    GENRES ||--o{ MOVIE_GENRES : belongs_to
    MOVIES ||--o{ SHOWTIMES : scheduled_in
    AUDITORIUMS ||--o{ SHOWTIMES : hosts

    SHOWTIMES ||--o{ SEAT_HOLDS : locks_temporarily
    SEATS ||--o{ SEAT_HOLDS : held_in

    CUSTOMERS ||--o{ BOOKINGS : places
    EMPLOYEES ||--o{ BOOKINGS : sells_at_counter
    SHOWTIMES ||--o{ BOOKINGS : booked_for
    PROMOTIONS ||--o{ BOOKINGS : discounts

    BOOKINGS ||--|{ BOOKING_SEATS : reserves
    BOOKINGS ||--|{ TICKETS : issues
    BOOKINGS ||--o{ PAYMENTS : paid_via
    BOOKINGS ||--o{ REFUNDS : refunded_via
    PAYMENTS ||--o{ REFUNDS : reverses

    PROMOTIONS ||--o{ PROMOTION_USAGES : tracked_in
    CUSTOMERS ||--o{ PROMOTION_USAGES : redeems
    CUSTOMERS ||--o{ LOYALTY_TRANSACTIONS : earns_spends
```

## 2. Ràng buộc toàn vẹn & Chống bán trùng ghế (Concurrency & Data Integrity)

1. **Ràng buộc duy nhất cấp độ Database (`@@unique([showtimeId, seatId])`)**:
   - Bảng `seat_holds`, `booking_seats` và `tickets` đều áp dụng khóa duy nhất trên cặp `(showtime_id, seat_id)`.
   - Khi hai giao dịch đồng thời cố gắng giữ hoặc mua cùng một ghế `E8` trong suất chiếu `ST-01`, PostgreSQL `SERIALIZABLE` / `READ COMMITTED` kết hợp khóa dòng (`SELECT ... FOR UPDATE`) và `UNIQUE CONSTRAINT` sẽ từ chối giao dịch thứ hai ngay lập tức với mã lỗi `409 Conflict`.
2. **Kiểu dữ liệu tiền tệ (`Decimal(14, 0)`)**:
   - Mọi trường tiền tệ (`base_price`, `surcharge_rate`, `subtotal_amount`, `discount_amount`, `final_amount`, `amount`) đều lưu dưới dạng số nguyên chính xác `Decimal(14, 0)` theo đơn vị VNĐ, tuyệt đối không dùng `FLOAT`/`DOUBLE`.
3. **Bảo toàn lịch sử phòng chiếu**:
   - Trước khi cập nhật sơ đồ ghế (`auditoriums`), hệ thống kiểm tra xem phòng chiếu có suất chiếu đang mở bán hoặc vé đã phát sinh hay không. Nếu có, hệ thống từ chối thay đổi cấu trúc hàng/cột và yêu cầu đóng các suất chiếu liên quan trước.
