# Hệ thống theo dõi kết luận, chỉ đạo — gói hosting Nam Sách

## Bản phát hành

- Mã nguồn: Site Nam Sách, phiên bản 33, cập nhật ngày 15/10/2026.
- Bản chạy riêng: Node.js 24, SQLite và thư mục lưu tệp nội bộ.
- Tên miền đã chuẩn bị trong cấu hình: `theodoinamsach.com`.
- Gói gồm mã nguồn, giao diện đã biên dịch, Docker/Caddy, cơ sở dữ liệu khởi tạo và tài liệu triển khai.
- Không gồm phiên đăng nhập, khóa/API key bên thứ ba hay thông tin cấu hình bí mật.

## Dữ liệu khởi tạo

Cơ sở dữ liệu được chụp từ D1 của Site ngày 15/10/2026, khoảng 11:14 giờ Việt Nam. Bản chụp có 45 nhiệm vụ tháng 10/2026, 22 đơn vị, 9 tài khoản, 3 báo cáo, 53 thông báo, 180 mục nhật ký và 2 dòng metadata tệp.

**Hai tệp DOCX tải lên ở Site chưa có phần nội dung nhị phân trong bản xuất này.** Tên và mã tệp được liệt kê trong `TAP-TIN-CHUA-KEM.txt`; cần lấy lại hai tệp gốc và chép vào `data/files/<mã-tệp>` trước khi chuyển hệ thống cho các đơn vị. Tệp thiếu không ảnh hưởng đăng nhập hay các luồng nhiệm vụ/báo cáo khác, nhưng liên kết tải hai DOCX này chưa dùng được cho tới khi bổ sung.

Phiên đăng nhập không được chuyển. Các tài khoản dùng mật khẩu đã băm hiện có; không đặt lại mật khẩu. Dữ liệu trên Site cũ phát sinh sau thời điểm chụp không tự đồng bộ sang máy chủ mới.

## Điều kiện hosting

Cần VPS hoặc hosting hỗ trợ Docker Compose, lưu trữ bền vững, mở cổng 80/443 và cho phép Node.js 24 trong container. Hosting chỉ có PHP/MySQL hoặc hosting tĩnh không chạy được ứng dụng này. Gói chưa cấu hình DNS, chưa triển khai lên máy chủ của người dùng và chưa cấp chứng thư HTTPS trên tên miền thực.

## Cài bằng Docker và Caddy

1. Giải nén gói vào thư mục riêng trên VPS, **không đặt trong `public_html`**.
2. Tạo tệp cấu hình và mã cài đặt riêng:

   ```bash
   cp .env.example .env
   chmod 600 .env
   openssl rand -hex 32
   ```

3. Điền `DOMAIN=theodoinamsach.com`, `APP_ORIGIN=https://theodoinamsach.com` và thay `SETUP_TOKEN` bằng chuỗi vừa tạo. Không dùng chuỗi mẫu trong `.env.example`.
4. Trỏ bản ghi DNS A của `theodoinamsach.com` tới IP máy chủ; mở TCP 80/443 và UDP 443. Nếu dùng cả `www.theodoinamsach.com`, thêm DNS và host tương ứng vào Caddyfile trước khi chạy.
5. Khởi động:

   ```bash
   docker compose up -d --build
   docker compose logs --tail=80 app https
   ```

6. Trước khi mở DNS cho người dùng, đăng nhập hệ thống và đổi mật khẩu tất cả tài khoản đã bàn giao; không tiếp tục dùng mật khẩu khởi tạo. Nếu DNS đã công khai, đổi mật khẩu ngay.
7. Kiểm tra số liệu, báo cáo, phân quyền và tải tệp bằng tài khoản admin cùng ít nhất một tài khoản đơn vị. Chỉ chuyển người dùng sang địa chỉ mới sau khi đối chiếu xong.

Caddy tự xin và gia hạn HTTPS khi DNS trỏ đúng và cổng mạng được mở. Nếu máy chủ đã có Nginx/Apache sử dụng cổng 80/443, không bật service `https`; cấu hình reverse proxy tới `http://127.0.0.1:8208` và vẫn giữ `APP_ORIGIN=https://theodoinamsach.com`.

## Chạy trực tiếp bằng Node.js 24

Từ thư mục gốc đã giải nén:

```bash
export NODE_ENV=production
export PORT=3080
export APP_ORIGIN=https://theodoinamsach.com
export DATA_DIR=/srv/nam-sach-data
export SETUP_TOKEN='CHUOI_NGAU_NHIEN_RIENG'
node startup/start.mjs
```

Dùng systemd/process manager để tự khởi động lại; reverse proxy HTTPS tới `127.0.0.1:3080`. Với Nginx, đặt `client_max_body_size 30m;`. Giới hạn cổng Node chỉ cho reverse proxy truy cập. Thư mục `DATA_DIR` phải nằm ngoài thư mục công khai và cho phép tài khoản ứng dụng đọc/ghi.

## Lưu trữ, sao lưu và cập nhật

- Cơ sở dữ liệu: `DATA_DIR/nam-sach.sqlite`.
- Tệp tải lên: `DATA_DIR/files/`.
- Container dùng thư mục bền vững `./data`; không xóa thư mục này khi cập nhật. Không dùng ổ đĩa tạm hoặc chạy nhiều bản ứng dụng cùng ghi một SQLite.
- Sao lưu khi ứng dụng dừng: sao chép toàn bộ `data/` ra vị trí an toàn. Kiểm tra bản sao phục hồi trước khi xóa hoặc thay máy chủ.
- Không đưa `.env`, tệp ZIP hoặc database vào thư mục website công khai.

## Kiểm thử và giới hạn xác nhận

Bộ kiểm thử tích hợp hiện có đạt **55/55** ca HTTP/SQLite: phân quyền; giao nhiệm vụ; chủ trì/phối hợp; gửi, trả, duyệt báo cáo; cập nhật tiến độ và bộ đếm; minh chứng; thông báo; lịch sử; sao lưu/phục hồi; xóa nhiệm vụ theo tháng và kiểm tra trang con không còn thấy nhiệm vụ/báo cáo đã xóa.

Bản dựng Node.js 24 và tính toàn vẹn SQLite/khóa ngoại đã được kiểm tra. Chưa kiểm thử DNS, HTTPS, Docker trên máy chủ đích, giao diện Safari/iPhone thực tế hoặc quy trình phục hồi trên hosting của người dùng. Đọc `BAO-CAO-RA-SOAT-LUONG.md` và `KIEM-TRA-GOI-HOSTING.txt` trước khi chuyển dữ liệu thật.
