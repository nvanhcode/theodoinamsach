# Bản đóng gói v30-hosting-r3

Đã kiểm tra chạy từ bản giải nén mới; xem KIEM-TRA-GOI-HOSTING.txt. Cần Node.js 24 hoặc Docker trên hosting/VPS. Gói không chạy trực tiếp trên hosting chỉ hỗ trợ PHP. Hai ảnh gốc nằm trong branding-originals.

# GÓI HOSTING ĐẦY ĐỦ — NAM SÁCH v30

Đóng gói ngày 11/10/2026. Bao gồm mã nguồn, bản chạy Node.js đã dựng, cơ sở dữ liệu thực tế đã xuất từ project và cấu hình Docker/HTTPS.

## Dữ liệu có trong gói

- 46 nhiệm vụ hiện có (gồm bộ 44 nhiệm vụ tháng 10 và 2 nhiệm vụ khác được giữ nguyên).
- 1 báo cáo, 23 đơn vị, 45 thông báo, 9 tài khoản, 134 mục nhật ký; giữ cấu hình và ID liên kết.
- Kho minh chứng có 0 tệp tại thời điểm xuất; không có binary minh chứng để chuyển.
- Giữ mật khẩu đã băm và quyền hiện tại; không đặt lại mật khẩu.
- Không chuyển phiên đăng nhập, bộ đếm đăng nhập sai và liên kết tải mẫu tạm thời. Người dùng đăng nhập lại.

## Cách chạy

Cần VPS/Docker hoặc hosting Node.js 24 với ổ đĩa bền vững và HTTPS. Không dùng hosting chỉ có PHP/MySQL hoặc hosting tĩnh.

1. Giải nén vào thư mục riêng trên máy chủ, ngoài public_html.
2. Sao chép `.env.example` thành `.env`, điền DOMAIN và SETUP_TOKEN riêng (tạo bằng `openssl rand -hex 32`).
3. Trỏ tên miền tới máy chủ, mở 80/443; chạy `docker compose up -d --build`.
4. Truy cập HTTPS và đăng nhập bằng tài khoản/mật khẩu đang dùng ở website cũ.
5. Đối chiếu dữ liệu, kiểm tra tải báo cáo, thử lưu/sửa trên máy tính và điện thoại trước khi chuyển người dùng sang địa chỉ mới.

Bộ khởi động chỉ nạp dữ liệu bàn giao khi DATA_DIR chưa có cơ sở dữ liệu. Nếu đã có cơ sở dữ liệu, hệ thống giữ nguyên và không ghi đè. Đọc README.md để triển khai không Docker và sao lưu.

Gói chứa dữ liệu nội bộ và mật khẩu đã băm. Chỉ giao cho người phụ trách triển khai; không tải ZIP hoặc initial-data lên thư mục công khai. Dữ liệu thay đổi trên website cũ sau thời điểm chụp không tự đồng bộ sang hosting mới.
