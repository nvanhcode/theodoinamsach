# Hệ thống theo dõi kết luận, chỉ đạo — gói triển khai riêng

Gói này chạy độc lập trên máy chủ của đơn vị bằng Node.js 24 hoặc Docker. Không phụ thuộc Firebase, Supabase, email/SMS hay API key dịch vụ nghiệp vụ. Nó gồm mã nguồn, bản dựng sẵn, SQLite bàn giao, tệp mẫu và cấu hình proxy HTTPS.

## Dữ liệu có trong gói

- 46 nhiệm vụ tháng 10/2026, 1 báo cáo, 23 đơn vị, 9 tài khoản và 45 thông báo trong bản chụp SQLite.
- Mật khẩu được lưu dưới dạng mã băm; gói không chứa mật khẩu dạng văn bản.
- Bản chụp không có tệp minh chứng nhị phân (0 tệp). Minh chứng tải lên sau triển khai được lưu trong `data/files/`.
- Phiên đăng nhập không được mang sang máy chủ mới. Khi khởi động lần đầu, hệ thống sao chép SQLite vào `data/nam-sach.sqlite`; các lần khởi động sau không ghi đè dữ liệu.
- Bộ đếm 45 thông báo là số trong bản chụp ban đầu. Khi chạy lần đầu, bộ nhắc việc tự tạo thêm thông báo theo các hạn cần xử lý; số này có thể tăng và được lưu trong cơ sở dữ liệu.

> Đây là bản sao dữ liệu tại ngày 11/10/2026, không đồng bộ các cập nhật phát sinh trên website đang dùng sau thời điểm xuất. Hãy kiểm tra số liệu trước khi chốt chuyển sang địa chỉ mới.

## Cách 1 — Docker với HTTPS tự động

Yêu cầu máy chủ Linux đã cài Docker Compose; tên miền trỏ về địa chỉ IP máy chủ; cổng 80 và 443 được mở.

1. Giải nén gói trên máy chủ và vào thư mục vừa giải nén.
2. Tạo cấu hình riêng:

   ```bash
   cp .env.example .env
   chmod 600 .env
   openssl rand -hex 32
   ```

3. Mở `.env`. Đặt `DOMAIN` và `APP_ORIGIN` theo tên miền sẽ sử dụng; thay `SETUP_TOKEN` bằng chuỗi ngẫu nhiên vừa tạo. Không chia sẻ token này.
4. Khởi chạy ứng dụng và Caddy:

   ```bash
   docker compose --profile tls up -d --build
   docker compose ps
   docker compose logs --tail=80 app https
   ```

   Có thể thay các lệnh trên bằng `sh deploy.sh` sau khi đã sửa `.env`.

Caddy tự xin HTTPS khi DNS đã trỏ đúng và máy chủ nhận được lưu lượng ở cổng 80/443. Truy cập `https://theodoinamsach.com` sau khi chứng chỉ được cấp.

## Cách 2 — Docker phía sau Nginx/HTTPS có sẵn

Giữ `HOST_PORT=8208`, cấu hình `DOMAIN`, `APP_ORIGIN` và `SETUP_TOKEN` trong `.env`, sau đó chạy:

```bash
docker compose up -d --build
```

Nginx trên máy chủ proxy tới `http://127.0.0.1:8208`. Ví dụ cấu hình trong khối `server` HTTPS:

```nginx
client_max_body_size 30m;
location / {
    proxy_pass http://127.0.0.1:8208;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## Cách 3 — Node.js không Docker

Yêu cầu Node.js 24. Đặt thư mục dữ liệu ngoài vùng web công khai và cấp quyền ghi cho tài khoản chạy ứng dụng:

```bash
export NODE_ENV=production
export PORT=3080
export APP_ORIGIN=https://theodoinamsach.com
export DATA_DIR=/srv/nam-sach-data
export SETUP_TOKEN='CHUOI_NGAU_NHIEN_RIENG'
node startup/start.mjs
```

Dùng systemd hoặc trình quản lý tiến trình của hosting để tự khởi động lại; cấu hình Nginx/Apache làm reverse proxy HTTPS tới ứng dụng. Với Nginx, đặt `client_max_body_size 30m;`. Chặn truy cập Internet trực tiếp vào cổng ứng dụng.

Hosting chỉ hỗ trợ PHP/MySQL không chạy được gói này. Không chạy nhiều bản sao ứng dụng cùng ghi một SQLite trên ổ mạng.

## Dữ liệu và cập nhật

- `data/nam-sach.sqlite`: tài khoản, nhiệm vụ, báo cáo, thông báo, đơn vị, thiết lập và lịch sử.
- `data/files/`: tệp minh chứng phát sinh sau khi triển khai.
- `initial-data/nam-sach.sqlite`: bản chụp gốc chỉ dùng nạp lần đầu; không đặt thư mục này dưới `public_html`.
- Cập nhật Docker: giải nén mã mới vào thư mục ứng dụng, giữ nguyên `.env` và `data/`, rồi chạy `docker compose up -d --build`. Không chạy `docker compose down -v`, không xóa `data/`.

Trước khi chuyển dùng chính thức, đăng nhập bằng tài khoản hiện có, kiểm tra quyền của từng đơn vị và đổi mật khẩu theo quy định của đơn vị. Không ghi mật khẩu thực tế vào `.env`, tài liệu công khai hoặc kho mã nguồn.

## Sao lưu và phục hồi

Với Docker Compose, dừng ứng dụng và sao lưu đồng thời SQLite cùng thư mục tệp:

```bash
docker compose stop app
tar -czf nam-sach-backup-$(date +%F).tar.gz data
docker compose start app
```

Giữ bản sao ở nơi riêng, giới hạn quyền truy cập. Khi phục hồi, dừng ứng dụng và phục hồi cả `nam-sach.sqlite` lẫn `files/` từ cùng một bản sao. Không ghép thủ công hai cơ sở dữ liệu.

## Dựng lại từ mã nguồn

Gói đã kèm bản chạy sẵn để triển khai nhanh. Nếu cần dựng lại, dùng Node.js 24 và pnpm theo `package.json`:

```bash
corepack enable
pnpm install --frozen-lockfile
node selfhost/build.mjs
```

Hoặc build image bằng `Dockerfile.build-source`. Kiểm tra `RELEASE.json` và `KIEM-TRA-GOI-HOSTING.txt` để biết phiên bản, dữ liệu và kết quả kiểm tra của gói.
