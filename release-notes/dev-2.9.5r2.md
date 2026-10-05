# dev-2.9.5r2

Bản sửa lỗi Windows x64, phiên bản **2.9.5-dev.2**.

- Chờ thư viện runtime và SQLite được cài đầy đủ trước khi khởi động, tránh lỗi
  `Cannot find module` khi app mở trong lúc cập nhật đang chép file.
- Thoát ứng dụng theo luồng chuẩn của Electron và ghi dữ liệu lưu trữ trước khi
  thoát, thay cho thoát cưỡng bức khi cập nhật.
- Khôi phục cài đặt từ bản lưu Electron nếu local storage bị mất hoặc hỏng;
  giữ ưu tiên cho cài đặt hiện có trong giao diện.
- Trình gỡ cài đặt của bản mới giữ lại dữ liệu người dùng theo mặc định.

Nếu bản dev.1 không mở được, chạy trực tiếp installer dev.2 lên thư mục đang cài,
không gỡ bản cũ trước. Cài đặt đã bị xóa chỉ khôi phục được khi bản lưu còn tồn tại.
