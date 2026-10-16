# JLPT N3 Countdown

## Ôn ngữ pháp N3

Trang chính chọn ngẫu nhiên đúng 6 mẫu khác nhau từ bộ 80 mẫu trong `grammar.json` mỗi lần mở hoặc quay lại app. Các mẫu của lượt trước được bỏ qua khi chọn lượt mới. Mỗi thẻ có ý nghĩa, cấu trúc và phần mở rộng để xem cách dùng, ví dụ Nhật–Việt, cách đọc và ghi chú.

Vào **Cài đặt → Danh sách ngữ pháp** để mở `grammar.html` và tra cứu toàn bộ 80 mẫu. Có thể tìm theo mẫu tiếng Nhật hoặc ý nghĩa tiếng Việt. Dữ liệu được giữ nguyên từ tệp người dùng cung cấp và có trong bộ nhớ offline sau khi phiên bản mới được tải đầy đủ.

Ứng dụng đếm ngược đến ngày thi JLPT N3 **06/12/2026**. Trang tính thời gian theo múi giờ Việt Nam (UTC+7), tự cập nhật mỗi giây, dùng được khi offline sau lần mở đầu tiên và có giao diện sáng/tối.

Mở URL GitHub Pages bằng Safari trên iPhone, chạm **Chia sẻ → Thêm vào Màn hình chính → Thêm**. Thời điểm đếm ngược là 00:00 ngày thi, không biểu thị giờ bắt đầu ca thi.

GitHub Pages: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Workflow sẽ triển khai từ nhánh `main`.

## Cá nhân hóa

Trên trang chính, chọn **biểu tượng Cài đặt → Cá nhân → Chỉnh sửa tên** để mở màn hình nhập tên. Mục thứ hai trong Cài đặt mở danh sách đầy đủ ngữ pháp. Tên được lưu bằng `localStorage` trên thiết bị hiện tại; để xóa, để trống ô tên rồi nhấn **Lưu tên**. Mỗi lần mở hoặc quay lại trang, app chọn một câu ngạn ngữ Nhật–Việt và tránh lặp ngay câu trước đó.

