# dev-2.9.4r1

Bản thử nghiệm Windows x64 từ nhánh `dev`.

- Đăng xuất vẫn xóa phiên cục bộ khi API không kết nối được; giới hạn thời gian
  chờ 5 giây và ngăn yêu cầu refresh cũ khôi phục cookie sau logout.
- Điểm danh chờ kết quả của cả hai loại thiết bị, nhận diện trạng thái đã điểm
  danh và xử lý lỗi mạng/API đúng.
- Tìm kiếm nghệ sĩ, album và playlist hỗ trợ tải thêm. Khi tải trang tiếp theo
  lỗi, giữ kết quả đã có và cho phép thử lại.
- Bổ sung nút phát bài hát, điều hướng bằng bàn phím và focus rõ ràng. Phím Space
  trên nút không còn kích hoạt thêm shortcut phát/dừng toàn ứng dụng.
- Cải thiện bố cục tìm kiếm trên màn hình nhỏ và độ rõ của chữ trong giao diện tối.
- Bao gồm cập nhật ứng dụng ngay trong app cho kênh stable/dev; gom phần cập nhật
  vào trang Giới thiệu trong Cài đặt.

Kiểm chứng cục bộ: 128 test web và 628 test desktop pass; typecheck web/desktop
và build web cho Electron pass. Luồng phân trang, thử lại và bàn phím được kiểm
tra trong Chromium bằng API giả lập ở nhiều kích thước màn hình.

Đây là prerelease; bản stable 2.9.4 và kênh cập nhật stable được giữ nguyên.
