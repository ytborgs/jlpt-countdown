# JLPT N3 Countdown

Ứng dụng web giúp người học theo dõi thời gian đến kỳ thi **JLPT N3 ngày 06/12/2026** và ôn ngữ pháp trong mỗi lần truy cập. Dự án sử dụng HTML, CSS và JavaScript thuần, hoạt động trên PC và điện thoại, không yêu cầu tài khoản hay cài đặt qua kho ứng dụng.

**[Mở ứng dụng](https://ytborgs.github.io/jlpt-countdown/)** · **[Mã nguồn GitHub](https://github.com/ytborgs/jlpt-countdown)**

## Tính năng

- **Đếm ngược:** hiển thị ngày, giờ, phút và giây còn lại; cập nhật mỗi giây khi trang đang mở. Thanh tiến độ tính từ ngày 05/10/2026.
- **Ôn 6 mẫu ngữ pháp:** mỗi lần mở hoặc quay lại trang chính, chọn ngẫu nhiên 6 mẫu khác nhau từ bộ 80 mẫu. Lượt mới bỏ qua các mẫu của lượt trước khi có đủ dữ liệu.
- **Thư viện 80 mẫu N3:** tra cứu theo mẫu tiếng Nhật, ý nghĩa, cấu trúc hoặc nội dung ví dụ; hỗ trợ tìm tiếng Việt không dấu.
- **Tài liệu ôn tập N3 tổng hợp:** 5 mục học từ bộ JSON được cung cấp, có tìm kiếm tiếng Nhật/tiếng Việt, tải thêm theo từng nhóm và luyện câu hỏi trắc nghiệm.
- **Furigana:** tên mẫu và câu ví dụ hiển thị cách đọc trên các cụm kanji. Mỗi thẻ có ý nghĩa, cấu trúc, cách dùng, ví dụ Nhật–Việt và ghi chú.
- **Ngạn ngữ Nhật–Việt:** thay đổi khi mở hoặc quay lại trang, tránh lặp ngay câu vừa xem.
- **Cá nhân hóa:** lưu tên để hiển thị lời chào trên trang countdown.
- **Giao diện thích ứng:** một cột trên mobile, nhiều cột trên PC; tự chuyển sáng/tối theo thiết bị. Tiêu đề và tìm kiếm ngữ pháp được ghim khi cuộn; countdown thu gọn xuất hiện trên thanh đầu trang khi thẻ lớn đã cuộn khỏi màn hình.
- **Sử dụng offline:** service worker lưu các trang và dữ liệu sau khi tải đầy đủ phiên bản hiện tại.

## Cách sử dụng

### Trang chính

1. Mở [ứng dụng](https://ytborgs.github.io/jlpt-countdown/).
2. Theo dõi thời gian còn lại đến ngày thi.
3. Ôn 6 mẫu ngữ pháp được chọn cho lượt truy cập hiện tại. Nhấn **Cách dùng và ví dụ** để mở nội dung chi tiết của từng mẫu.

Mốc đếm ngược là **00:00 ngày 06/12/2026 theo giờ Việt Nam (UTC+7)**, không phải giờ bắt đầu ca thi. Thời gian được tính từ đồng hồ của thiết bị.

### Cài đặt

Nhấn biểu tượng **⚙** ở góc trên trang countdown:

| Mục | Chức năng |
| --- | --- |
| Cá nhân → Chỉnh sửa tên | Nhập hoặc thay đổi tên hiển thị. Để trống rồi lưu để xóa tên. |
| Ngữ pháp N3 → Danh sách ngữ pháp | Mở đủ 80 mẫu và sử dụng ô tìm kiếm. |
| Tài liệu học → Tài liệu ôn tập N3 tổng hợp | Chọn bộ tài liệu, tìm kiếm và học theo từng mục. |
| Về ứng dụng → Mã nguồn GitHub | Mở repository của dự án trong tab mới. |

### Tài liệu ôn tập N3 tổng hợp

Trang tài liệu gồm các bộ dữ liệu sau, giữ nguyên nội dung JSON từ gói `n3-study-data.zip` và không công bố thư mục xử lý nội bộ `_work`:

| Bộ tài liệu | Dữ liệu hiện có | Trạng thái |
| --- | --- | --- |
| Ngữ pháp cơ bản | 80 mẫu | Có cấu trúc, cách dùng, ví dụ và furigana. |
| Hán tự N3 | 416 mục | Bản trích xuất cần đối chiếu các cột dữ liệu. |
| Động từ phức hợp | 77/80 mục theo tên tài liệu | Chưa đủ bộ; chưa có cách đọc để tạo furigana. |
| Trắc nghiệm Hán tự | 96/96 câu | Có đáp án chép từ phần khoanh trong tài liệu (`answer_source: visual_annotation`); chọn một phương án để xem phản hồi đúng/sai. |
| Từ đồng nghĩa dễ nhầm | 30 câu | Có đáp án suy luận ngôn ngữ (`answer_source: linguistic`), có chấm đúng/sai; không phải đáp án chính thức. |

Mỗi bộ có tìm kiếm riêng và hiển thị tối đa 30 mục mỗi lượt, nhấn **Xem thêm** để mở tiếp. Ứng dụng giữ nguyên `answer_source` và chấm theo đáp án trong JSON, không coi các đáp án này là đáp án chính thức của kỳ thi. Các trường thiếu không được tự bổ sung. Những nhóm chỉ có tên trong manifest nguồn nhưng chưa có JSON nội dung chưa được đưa lên trang.

### Thêm biểu tượng trên iPhone

Mở ứng dụng bằng **Safari → Chia sẻ → Thêm vào Màn hình chính**. Biểu tượng này mở web app; số đếm cập nhật khi ứng dụng đang mở.

## Lưu trữ trên thiết bị

Ứng dụng dùng `localStorage` để lưu tên, ngạn ngữ vừa xem và danh sách ngữ pháp của lượt trước. Tên không được ứng dụng gửi lên máy chủ.

Dữ liệu này thuộc từng trình duyệt và địa chỉ website, không tự đồng bộ giữa các thiết bị. Xóa dữ liệu website có thể xóa cả các lựa chọn đã lưu. Nội dung ngữ pháp và furigana được lưu sẵn trong dự án, không cần gọi dịch vụ dịch hoặc chuyển cách đọc bên ngoài.

Để dùng offline, hãy mở ứng dụng khi có mạng và chờ tải đầy đủ. Việc cập nhật phiên bản mới vẫn cần kết nối mạng.

## Chạy trên máy cá nhân

Yêu cầu: **Git**, **Python 3** và một trình duyệt hiện đại. Không có bước cài dependency hoặc build.

```bash
git clone https://github.com/ytborgs/jlpt-countdown.git
cd jlpt-countdown
python3 -m http.server 8000
```

Mở **http://localhost:8000**. Sử dụng HTTP server thay vì mở trực tiếp file HTML để JavaScript module và dữ liệu JSON tải đúng. Service worker hoạt động trên localhost hoặc HTTPS.

## Cấu trúc dự án

| Tệp | Vai trò |
| --- | --- |
| `index.html` | Trang countdown, lời chào, ngạn ngữ và 6 mẫu ngữ pháp ngẫu nhiên. |
| `grammar.html` | Danh sách đầy đủ và ô tìm kiếm ngữ pháp. |
| `grammar.js`, `grammar.css` | Chọn mẫu, tìm kiếm, dựng thẻ, hiển thị furigana và định dạng ngữ pháp. |
| `grammar.json` | Bộ dữ liệu 80 mẫu cùng các đoạn văn bản/cách đọc dùng cho furigana. |
| `study.html`, `study.js`, `study.css` | Danh mục tài liệu, tìm kiếm, thẻ học và tương tác trắc nghiệm. Mỗi bộ có đường dẫn hash riêng. |
| `study-data/topics.json`, `study-data/*.json` | Mục lục gọn và 5 bộ dữ liệu học; metadata nguồn được giữ để đối chiếu. |
| `settings.html`, `profile.html` | Danh mục Cài đặt và màn hình chỉnh sửa tên. |
| `settings.js`, `settings.css` | Lưu tên và định dạng các trang Cài đặt. |
| `manifest.webmanifest`, `icon.svg`, `apple-touch-icon.png` | Thông tin và biểu tượng cho web app trên màn hình chính. |
| `sw.js` | Danh sách tài nguyên offline và phiên bản cache. |
| `.github/workflows/pages.yml` | Tự động triển khai GitHub Pages từ nhánh `main`. |

## Cập nhật nội dung ngữ pháp

Dữ liệu được biên soạn từ tài liệu người dùng cung cấp. Mỗi mục có mã `id`, mẫu ngữ pháp, ý nghĩa, cấu trúc, cách dùng, ví dụ tiếng Nhật, cách đọc, bản dịch và ghi chú.

Furigana sử dụng `pattern_ruby` và `example_ruby`, gồm các đoạn `text` và `reading` tùy chọn. Ví dụ:

```json
[
  { "text": "大学", "reading": "だいがく" },
  { "text": "に" },
  { "text": "行", "reading": "い" },
  { "text": "く" }
]
```

Khi sửa dữ liệu:

- Giữ `id` duy nhất và cập nhật `total` theo số mục thực tế.
- Các đoạn `text` của furigana phải ghép lại đúng tên mẫu hoặc câu ví dụ gốc.
- Kiểm tra cách đọc và bản dịch khi thay đổi câu ví dụ.
- Dữ liệu `source_page` được giữ để đối chiếu, không hiển thị trên giao diện.

## Triển khai GitHub Pages

1. Trong repository, mở **Settings → Pages**.
2. Chọn **Build and deployment → Source: GitHub Actions**.
3. Đẩy thay đổi lên nhánh `main`. Workflow **Deploy GitHub Pages** sẽ tự chạy; cũng có thể chạy thủ công từ tab **Actions**.
4. Kiểm tra workflow thành công rồi mở [website đã triển khai](https://ytborgs.github.io/jlpt-countdown/).

Khi cập nhật tài nguyên được lưu offline, tăng phiên bản `CACHE` trong `sw.js`. Nếu thêm trang, CSS, JavaScript hoặc dữ liệu mới cần dùng offline, bổ sung đường dẫn vào `ASSETS`. Sau khi triển khai, tải lại ứng dụng khi có mạng để nhận phiên bản mới.

