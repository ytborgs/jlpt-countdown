# JLPT N3 Countdown

Ứng dụng đếm ngược đến ngày thi JLPT N3 **06/12/2026**. Trang tính thời gian theo múi giờ Việt Nam (UTC+7), tự cập nhật mỗi giây, dùng được khi offline sau lần mở đầu tiên và có giao diện sáng/tối.

Mở URL GitHub Pages bằng Safari trên iPhone, chạm **Chia sẻ → Thêm vào Màn hình chính → Thêm**. Thời điểm đếm ngược là 00:00 ngày thi, không biểu thị giờ bắt đầu ca thi.

GitHub Pages: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Workflow sẽ triển khai từ nhánh `main`.

## Widget trên Home Screen iPhone

Mở `/widget.html` trên website và làm theo hướng dẫn để cài widget Scriptable. Script ở `widget.js` không cần internet khi chạy, hiển thị số ngày còn lại và mở website khi chạm. iOS quyết định thời điểm làm mới widget nên số ngày có thể cập nhật muộn hơn nửa đêm.
