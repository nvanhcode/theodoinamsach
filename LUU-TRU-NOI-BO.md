# Lưu trữ nội bộ và vận hành

Tài khoản, mật khẩu băm, đơn vị, nhiệm vụ, báo cáo, cấu hình và lịch sử đều nằm trong SQLite tại DATA_DIR/nam-sach.sqlite. Nội dung minh chứng nằm trong DATA_DIR/files. Bản dữ liệu khởi tạo nằm trong initial-data, được sao chép một lần khi cài mới.

Không dùng Firebase, Supabase, API gửi SMS/email hay kho tệp ngoài cho các luồng nghiệp vụ. Không yêu cầu API key bên thứ ba. Docker tải image và Caddy cấp chứng chỉ HTTPS có thể cần kết nối Internet trong khâu triển khai. SETUP_TOKEN là mã tự tạo của hệ thống.

Giữ volume/thư mục DATA_DIR bền vững khi cập nhật mã và khởi động lại. Không công khai thư mục dữ liệu hoặc ZIP bàn giao. Không có chức năng xem lại mật khẩu người dùng; Admin đặt lại mật khẩu theo quyền.

Gói là bản chụp tại thời điểm bàn giao. Những cập nhật sau đó trên website cũ không tự đồng bộ. Dừng nhập liệu trên địa chỉ cũ khi chuyển sang vận hành chính thức trên hosting mới và đối chiếu các thay đổi phát sinh.
