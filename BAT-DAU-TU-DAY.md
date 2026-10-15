# Bắt đầu triển khai trên theodoinamsach.com

Cần VPS/hosting hỗ trợ Docker Compose, DNS A trỏ về máy chủ và cổng 80/443 mở. Hosting chỉ hỗ trợ PHP hoặc hosting tĩnh không tương thích.

1. Giải nén ngoài `public_html`.
2. `cp .env.example .env`; đặt quyền `chmod 600 .env`; thay `SETUP_TOKEN` bằng giá trị riêng từ `openssl rand -hex 32`.
3. Giữ `DOMAIN=theodoinamsach.com` và `APP_ORIGIN=https://theodoinamsach.com`.
4. Chạy `docker compose up -d --build`; xem log `docker compose logs --tail=80 app https`.
5. Mở `https://theodoinamsach.com`; đăng nhập tài khoản hiện có, kiểm tra dữ liệu và tải tệp. Bổ sung hai tệp liệt kê ở `TAP-TIN-CHUA-KEM.txt`.

Caddy trong Compose xin HTTPS tự động. Nếu hosting đã có Nginx/Apache trên cổng 80/443, tắt service `https` trong Compose và reverse proxy tới `http://127.0.0.1:8208`.

Không xóa `data/`; đây là database và kho tệp đang chạy. Backup toàn bộ thư mục trước mọi lần cập nhật. Xem `README.md` để biết chạy trực tiếp bằng Node.js 24, sao lưu và giới hạn nghiệm thu.
