# Báo cáo rà soát luồng admin – đơn vị

## Luồng dữ liệu đã đối chiếu

1. **Giao việc:** admin nhập hoặc nhập Excel; nhiệm vụ có tháng, đơn vị chủ trì, đơn vị phối hợp, thời hạn và chỉ tiêu. Dữ liệu được lưu tập trung theo ID nhiệm vụ.
2. **Trang đơn vị:** API chỉ trả nhiệm vụ mà tài khoản được phép xem. Đơn vị chủ trì có quyền gửi báo cáo; đơn vị phối hợp nhìn thấy tiến độ chủ trì và gửi thông tin phối hợp gắn với cùng nhiệm vụ.
3. **Báo cáo:** báo cáo lưu theo `taskId` và đơn vị gửi. Đơn vị chủ trì hoàn thiện báo cáo bằng nội dung/tệp; báo cáo gửi về trang admin để phê duyệt. Phối hợp không làm tăng số báo cáo chủ trì.
4. **Phê duyệt:** xác nhận hoặc yêu cầu bổ sung cập nhật trạng thái báo cáo, nhiệm vụ và thông báo. Bộ đếm hoàn thành lấy trạng thái đã xác nhận; tiến độ có thể vượt 100% theo dữ liệu báo cáo.
5. **Nhắc việc:** nhiệm vụ, thời hạn báo cáo, quá hạn và chỉ đạo nhắc việc có bộ lọc theo đối tượng. Trạng thái đã đọc gắn với người nhận, không làm mất nhắc việc ở tài khoản khác.
6. **Đồng bộ trang con:** các tài khoản đọc từ cùng CSDL. Khi admin xóa nhiệm vụ theo tháng, API xóa nhiệm vụ và dữ liệu phụ thuộc; trang đơn vị không còn nhận nhiệm vụ/báo cáo đó ở lần nạp dữ liệu kế tiếp. Giao diện tự nạp dữ liệu theo chu kỳ 15 giây và khi quay lại tab.
7. **Kiểm soát:** kiểm thử phân quyền, giới hạn truy cập ngoài đơn vị, phiên đăng nhập bị thu hồi, lịch sử thao tác và tải tệp.

## Đối chiếu bản dữ liệu chụp

- 45 nhiệm vụ trong tháng 10/2026; 22 đơn vị; 9 tài khoản.
- 3 báo cáo (2 xác nhận, 1 nháp); 53 thông báo; 4 bản ghi phối hợp; 180 mục nhật ký.
- Không phát hiện nhiệm vụ thiếu đơn vị; báo cáo mồ côi; báo cáo sai đơn vị; thông báo mồ côi; metadata tệp không có bản ghi cha; hoặc tài khoản tham chiếu đơn vị không tồn tại.
- Kiểm tra SQLite `integrity_check` đạt; `foreign_key_check` không có lỗi.

## Đã chạy kiểm thử

55/55 ca tích hợp HTTP/SQLite đạt. Các ca bao gồm luồng chủ trì/phối hợp, gửi và duyệt báo cáo, báo cáo dưới và trên 100%, đếm hoàn thành, tải minh chứng, thông báo, tải lại sau khởi động, quyền admin, xóa theo tháng và kiểm tra tài khoản đơn vị không còn nhận nhiệm vụ/báo cáo đã xóa.

## Việc cần hoàn tất trên hosting đích

- Chuyển hai binary DOCX được liệt kê trong `TAP-TIN-CHUA-KEM.txt`.
- Trỏ DNS tới VPS và xác nhận cổng 80/443; HTTPS chỉ được cấp khi domain đã trỏ đúng.
- Đăng nhập bằng admin và tối thiểu một tài khoản đơn vị; thử giao việc, phối hợp, báo cáo, duyệt, tải xuống, sửa/xóa, Excel, sao lưu và khôi phục.

**Giới hạn:** kết quả kiểm thử là kiểm thử API/SQLite và đóng gói cục bộ. Chưa thể xác nhận DNS, SSL, quyền truy cập hosting hay các thao tác giao diện trên thiết bị thật.
