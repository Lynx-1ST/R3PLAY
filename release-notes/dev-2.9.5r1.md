# dev-2.9.5r1

Bản thử nghiệm Windows x64 từ nhánh `dev`, phiên bản **2.9.5-dev.1**.

- Bộ logo R/Play màu mint mới: icon ứng dụng, khay hệ thống, favicon và PWA.
- Font Manrope được đóng gói trong ứng dụng, dùng trên toàn bộ giao diện và
  phần logo mở đầu; hỗ trợ tiếng Việt.
- Logo mở rộng thành chữ R3PLAYX, kèm quầng sáng nhẹ và ánh sáng lướt qua một lần.
  Hiệu ứng chờ cửa sổ desktop hiện ra rồi mới bắt đầu.
- Thêm công tắc **Cài đặt → Thử nghiệm → Animation khi mở ứng dụng**. Lựa chọn
  được lưu và áp dụng từ lần mở tiếp theo; mặc định bật.
- Xử lý Service Worker và cache PWA cũ khiến bản đã cài vẫn hiện giao diện cũ.
  Giữ nguyên tài khoản, playlist, cài đặt và dữ liệu nghe nhạc.
- Sửa đường dẫn icon đóng gói cho macOS và Linux.

Bao gồm các cải tiến từ dev-2.9.4r1: đăng xuất offline, điểm danh, phân trang
tìm kiếm, thử lại khi lỗi, thao tác phát bằng bàn phím và cập nhật stable/dev.

Kiểm chứng cục bộ: 131 test web và 628 test desktop pass. Công tắc đã được kiểm
tra trong bản desktop đóng gói: tắt, thoát/mở lại không hiện intro; bật lại bằng
bàn phím và mở lại có intro. Font và hiệu ứng đã được kiểm tra với profile hiện
có, bao gồm tình huống cache PWA cũ.

Đây là prerelease. Kênh stable và bản stable 2.9.4 được giữ nguyên.
