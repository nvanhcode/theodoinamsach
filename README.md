# Triển khai website Đảng ủy xã Nam Sách — v30 đầy đủ dữ liệu

## 1. Phạm vi bàn giao

Nguồn nghiệp vụ: commit `21622ae8d3ab87aa3475530c17ad263dcaaa7975`, bản Sites v30, gồm sửa biểu mẫu điện thoại. Gói bổ sung bản chạy tự quản, dữ liệu SQLite thật, bộ nạp dữ liệu lần đầu và tài liệu triển khai; không thay đổi website đang dùng.

`initial-data/nam-sach.sqlite` là bản chụp dữ liệu thật. `selfhost-dist` là mã đã biên dịch. `app`, `components`, `lib`, `selfhost` và các tệp cấu hình là mã nguồn. `drizzle` chứa schema và migrations. Không cần API key Firebase/Supabase, email, SMS hoặc dịch vụ nghiệp vụ bên ngoài. Chạy Node với SQLite và kho minh chứng ở máy chủ nội bộ của đơn vị. Docker/Caddy có thể cần mạng để tải image và cấp HTTPS; đó không phải API key nghiệp vụ.

Dữ liệu và số lượng: xem RELEASE.json. Bảng nghiệp vụ và tài khoản được đọc lại để đối chiếu không thay đổi giữa hai lượt xuất. Công cụ xuất không có giao dịch khóa toàn project; bản sao là tại thời điểm bàn giao, không phải đồng bộ liên tục. Phiên đăng nhập/attempts/link tải tạm bị loại bỏ có chủ đích. Metadata tệp minh chứng bằng 0 nên không thiếu binary trong gói này.

## 2. Docker và HTTPS (khuyến nghị)

Máy chủ Linux có Docker Compose, ổ đĩa bền vững, tên miền trỏ đúng IP; cổng 80/443 mở.

```bash
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
```

Điền DOMAIN trong `.env` bằng tên miền, không có https://; SETUP_TOKEN bằng chuỗi ngẫu nhiên vừa tạo.

```bash
docker compose up -d --build
docker compose logs --tail=80 app https
```

Mở `https://ten-mien-cua-ban.vn`. Caddy cấp HTTPS. Dockerfile mặc định dùng bản dựng sẵn; không cần cài pnpm/node_modules để chạy. SQLite và tệp mới lưu vào volume `nam_sach_data` (có thể có tiền tố tên project Compose).

Giữ nguyên tên project/thư mục Compose khi cập nhật. Không chạy `docker compose down -v` vì xóa dữ liệu. Bộ startup chỉ sao chép SQLite ban đầu vào thư mục rỗng, tuyệt đối không thay thế database đang có. Nếu đã có volume từ bản cài trống trước đó, dừng và sao lưu volume đó; dùng project/volume mới để thử bản bàn giao này, không xóa dữ liệu cũ tùy tiện.

## 3. Hosting Node.js không Docker

Dùng Node.js 24. Chạy từ thư mục gốc của gói:

```bash
export NODE_ENV=production
export PORT=3080
export APP_ORIGIN=https://ten-mien-cua-ban.vn
export DATA_DIR=/srv/nam-sach-data
export SETUP_TOKEN=CHUOI_NGAU_NHIEN_RIENG
node startup/start.mjs
```

Cấu hình systemd hoặc trình quản lý tiến trình của hosting để tự khởi động lại. Reverse proxy HTTPS tới 127.0.0.1:3080; nếu Nginx, đặt `client_max_body_size 30m;`. Giới hạn truy cập trực tiếp cổng 3080 bằng firewall. Cookie Secure cần HTTPS. DATA_DIR phải được tài khoản chạy ứng dụng đọc/ghi và ở ngoài thư mục công khai.

Không chạy `selfhost-dist/server/server.mjs` trực tiếp trong lần cài đầu nếu muốn nạp dữ liệu bàn giao; dùng `startup/start.mjs`. Hosting chỉ có PHP/MySQL không phù hợp. Không dùng filesystem tạm, nhiều bản sao ứng dụng hoặc ổ mạng dùng chung SQLite.

## 4. Tài khoản và dữ liệu

Đăng nhập bằng tài khoản/mật khẩu thực tế đang dùng tại thời điểm xuất. Không đổi về admin/admin và không đặt lại mật khẩu đơn vị. Gói giữ 9 tài khoản và phạm vi phân quyền hiện tại; màn hình yêu cầu đổi mật khẩu giữ trạng thái hiện có. Không có mật khẩu văn bản thuần trong database.

Báo cáo, tác giả và đơn vị giữ nguyên ID, nên không phải ghép lại tài khoản. Bộ 44 nhiệm vụ tháng 10 giữ nguyên; 2 nhiệm vụ khác được giữ nguyên theo nguồn. Tháng mới không tự sao chép dữ liệu.

Sau khi nghiệm thu, thống nhất một địa chỉ nhập liệu chính. Dữ liệu phát sinh ở website cũ sau lúc xuất không tự xuất hiện trên hosting mới. Không chạy hai địa chỉ cùng nhập liệu mà không có quy trình đối chiếu.

## 5. Vị trí dữ liệu nội bộ

- DATA_DIR/nam-sach.sqlite: tài khoản, đơn vị, nhiệm vụ, báo cáo, cấu hình, lịch sử và metadata minh chứng.
- DATA_DIR/files/: nội dung minh chứng tải lên sau triển khai.
- SQLite có thể tạo thêm -wal và -shm trong lúc chạy.
  Không lưu dữ liệu nghiệp vụ chỉ trong localStorage. Không xóa DATA_DIR khi cập nhật mã. Không đặt initial-data hay bản backup trong public hoặc public_html.

## 6. Sao lưu và phục hồi

Dừng ứng dụng, sao lưu toàn bộ DATA_DIR/volume và kho files cùng lúc để nhất quán. Ví dụ:

```bash
mkdir -p backups
docker compose stop app
docker compose run --rm --no-deps --entrypoint tar app -czf - -C /data . > backups/nam-sach-full.tar.gz
docker compose start app
```

Giữ bản sao ở nơi khác, hạn chế quyền đọc. Phục hồi khi ứng dụng dừng vào thư mục/volume trống, sau khi đã sao lưu bản hiện tại. Không trộn hai database bằng chép đè từng bảng. Thu hồi phiên đăng nhập khi phục hồi bằng công cụ quản trị SQLite tại máy chủ.

Sao lưu JSON trên giao diện chỉ là nghiệp vụ, không thay cho backup toàn DATA_DIR: không có mật khẩu, phiên hay binary minh chứng.

## 7. Sửa nguồn và cập nhật

Để tự dựng: cài phiên bản pnpm theo packageManager trong package.json, chạy:

```bash
pnpm install --frozen-lockfile
node selfhost/build.mjs
```

Hoặc dùng Dockerfile.build-source. Khi cập nhật mã, giữ nguyên DATA_DIR. Không lấy `dist` của Sites làm bản chạy Node. Các thư viện cần tải khi dựng lại; bản dựng sẵn đã kèm trong gói.

## 8. Kiểm thử và nghiệm thu

49 ca HTTP/SQLite đã đạt (KIEM-THU-TICH-HOP-49.txt), gồm lưu/sửa, phân quyền, xung đột, minh chứng, lịch sử, khởi động lại giữ dữ liệu và phục hồi. Kiểm thử 8 tài khoản, tài khoản mới, file nén và giới hạn 3 tệp ở KIEM-THU.txt. Bộ fixture tích hợp đã đổi tên tài khoản thử để tránh trùng 8 tài khoản cấp sẵn. Các test dùng dữ liệu tách biệt, không ghi vào initial-data.

Bản chụp được kiểm tra integrity_check và foreign_key_check, cùng khởi động/khởi động lại bằng startup. Xem KIEM-THU-DONG-GOI.txt.

Trên hosting đích cần kiểm tra HTTPS; đăng nhập Admin và đơn vị; 46 nhiệm vụ/1 báo cáo; lưu và tải lại trang; tải minh chứng; nhập/xuất Excel; sửa báo cáo trên iPhone/Android; sao lưu và diễn tập phục hồi. Chưa kiểm thử Docker/DNS/HTTPS trên máy chủ đích hoặc Safari thực tế; không coi kiểm thử API là nghiệm thu giao diện điện thoại.
