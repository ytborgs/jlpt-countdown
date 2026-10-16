# JLPT N3 Countdown

Ứng dụng web giúp người học theo dõi thời gian đến kỳ thi **JLPT N3 ngày 06/12/2026** và ôn ngữ pháp trong mỗi lần truy cập. Dự án sử dụng HTML, CSS và JavaScript thuần, hoạt động trên PC và điện thoại, không yêu cầu tài khoản hay cài đặt qua kho ứng dụng.

**[Mở ứng dụng](https://ytborgs.github.io/jlpt-countdown/)** · **[Mã nguồn GitHub](https://github.com/ytborgs/jlpt-countdown)**

## Tính năng

- **Đếm ngược:** hiển thị ngày, giờ, phút và giây còn lại; cập nhật mỗi giây khi trang đang mở. Thanh tiến độ tính từ ngày 05/10/2026.
- **Ôn 6 mẫu ngữ pháp:** mỗi lần mở hoặc quay lại trang chính, chọn ngẫu nhiên 6 mẫu khác nhau từ bộ 80 mẫu. Lượt mới bỏ qua các mẫu của lượt trước khi có đủ dữ liệu.
- **Thư viện 80 mẫu N3:** tra cứu theo mẫu tiếng Nhật, ý nghĩa, cấu trúc hoặc nội dung ví dụ; hỗ trợ tìm tiếng Việt không dấu.
- **Tài liệu ôn tập N3 tổng hợp:** 18 bộ tài liệu từ dữ liệu v9, nhóm theo Ngữ pháp / Từ vựng & Hán tự / Trắc nghiệm / Mẹo & bí kíp, có chip lọc nhóm, tìm kiếm tiếng Nhật/tiếng Việt, và badge tiến độ local (đúng–sai hoặc đã thuộc) trên từng thẻ danh mục. Bộ trắc nghiệm có chế độ **Phiên** (một câu mỗi lần, tiếp tục chỗ chưa làm, phiên ngắn 20 câu, CTA Câu tiếp sau khi chọn). Trang chủ có lối tắt **Tài liệu ôn** / **Luyện nhanh**; phiên hỗ trợ phím `1`–`4` / `Enter` / mũi tên; bộ lọc thu gọn trên mobile; có màn hoàn thành với CTA ôn câu sai.
- **Furigana:** tên mẫu và câu ví dụ hiển thị cách đọc trên các cụm kanji. Mỗi thẻ có ý nghĩa, cấu trúc, cách dùng, ví dụ Nhật–Việt và ghi chú.
- **Ngạn ngữ Nhật–Việt:** thay đổi khi mở hoặc quay lại trang, tránh lặp ngay câu vừa xem.
- **Cá nhân hóa:** lưu tên để hiển thị lời chào trên trang countdown.
- **Giao diện thích ứng:** một cột trên mobile, nhiều cột trên PC; tự chuyển sáng/tối theo thiết bị. Tiêu đề và tìm kiếm ngữ pháp được ghim khi cuộn; countdown thu gọn xuất hiện trên thanh đầu trang khi thẻ lớn đã cuộn khỏi màn hình.
- **Sử dụng offline:** service worker lưu các trang và dữ liệu sau khi tải đầy đủ phiên bản hiện tại.

Practice hiển thị đúng bằng màu xanh, sai bằng màu đỏ; khi chọn sai, đáp án đúng đồng thời được tô xanh, kèm phản hồi và huy hiệu ✓/✗. Câu chưa có đáp án chỉ đánh dấu đã chọn và không chấm.

Dữ liệu v8 có phần phân tích từng lựa chọn và tóm tắt khi được cung cấp (nghĩa VI, lý do đúng/sai) cho 246 câu có đáp án. Khối **Chi tiết** chỉ mở sau khi chọn, nhấn mạnh phương án đã chọn và cập nhật khi chọn lại. `explanation_source: linguistic` là phần bổ sung ôn tập, không phải nguồn đáp án chính thức; key visual giữ nguyên. Hard-quiz chưa có key nên không hiện phân tích đúng/sai.

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

Trang tài liệu gồm các bộ dữ liệu sau, giữ nguyên nội dung JSON từ gói `n3-study-data-for-jlpt-countdown-v9.zip` và không công bố thư mục xử lý nội bộ `_work`. Có 18 bộ tài liệu, mỗi mục trong `topics.json` có `group` (`grammar` / `vocab` / `practice` / `tips`); bộ trắc nghiệm thêm `gradable` để phân biệt chấm điểm và chỉ chọn. Danh mục hiển thị tiến độ từ `localStorage` (không tải lại toàn bộ JSON bộ):

| Bộ tài liệu | Dữ liệu hiện có | Trạng thái |
| --- | --- | --- |
| Ngữ pháp cơ bản | 80 mẫu | Có cấu trúc, cách dùng, ví dụ và furigana. |
| Ngữ pháp N3–N2 theo SET | 42 mẫu | Dùng thẻ ngữ pháp; một số ruby chỉ có văn bản gốc, chưa có cách đọc. |
| Bí kíp ngữ pháp N3 | 30 mẫu | Bản rút gọn, ví dụ linguistic. |
| Bí kíp N3 (bản đáp án) | 30 mẫu | Dữ liệu có type=tips nhưng đủ trường ngữ pháp; hiển thị bằng thẻ ngữ pháp để đối chiếu. |
| Ngữ pháp Ebook N3 | 39 mẫu | Thẻ ngữ pháp dùng chung; một số cách dùng/ví dụ còn thiếu trong dữ liệu. |
| Bí kíp trúng tủ N3 | 84 mục | Đã mở; toàn bộ body có nội dung, giữ xuống dòng; nguồn visual_transcription/linguistic. |
| Thành ngữ / tượng thanh (sổ tay) | 70 mục | Toàn bộ có ví dụ tiếng Nhật và ruby từ pack; một số nghĩa VI để null kèm needs_verify, không tự bổ sung. |
| Tự động từ / Tha động từ | 141 mục | Động từ, cách đọc, nghĩa và trợ từ/tự–tha khi có; nghĩa VI linguistic. |
| Hán tự N3 | 416 mục | Bản trích xuất cần đối chiếu các cột dữ liệu. |
| Động từ phức hợp | 78 mục | Có cách đọc, furigana cho từ và ví dụ, kèm dịch ví dụ; nguồn `linguistic`. |
| Trắc nghiệm Hán tự | 96/96 câu | Có đáp án chép từ phần khoanh trong tài liệu (`answer_source: visual_annotation`); chọn một phương án để xem phản hồi đúng/sai. |
| Từ đồng nghĩa dễ nhầm | 30 câu | Từ cần hỏi được đánh dấu; 30/30 đáp án `visual_annotation` từ khoanh đỏ trong PDF. Câu #19 và #26 có đáp án 1. |
| Cách dùng từ | 50 câu | Có đáp án `visual_annotation`. |
| Câu hỏi khó dễ lừa | 30 câu | PDF chưa có key; đáp án để null, chỉ chọn để tự ôn và không chấm đúng/sai. |
| Từ gần nghĩa các năm | 70 câu | Có đáp án `visual_annotation`, đánh dấu từ cần hỏi khi có. |
| Tổng hợp phó từ N3 | 81 mục | Phó từ, cách đọc khi có và nghĩa tiếng Việt. |
| Phó từ với mẫu câu đặc định | 25 mục | Phó từ, mẫu đi kèm và nghĩa tiếng Việt. |
| Từ nối đọc hiểu | 43 mục | Thẻ `type=reading`: từ nối, nhóm chức năng, nghĩa và đủ 43 ví dụ tiếng Nhật. |

Mỗi bộ có tìm kiếm riêng và hiển thị toàn bộ mục ngay khi tải xong; chỉ cần cuộn để xem hết. Ứng dụng giữ nguyên `answer_source` và chấm theo đáp án trong JSON, không coi các đáp án này là đáp án chính thức của kỳ thi. Các trường thiếu không được tự bổ sung. Những nhóm chỉ có tên trong manifest nguồn nhưng chưa có JSON nội dung chưa được đưa lên trang.

`connectors` dùng nhánh dựng thẻ `reading` để hiển thị `connector_jp`, `section`, `meaning_vi` và `example_jp` khi có. Thẻ `tips` hỗ trợ tiêu đề và nội dung nhiều dòng; nếu thiếu body, chỉ hiển thị thông báo đang đối chiếu và huy hiệu cần đối chiếu.

Pack v9 loại bỏ bộ từ nối trích xuất cũ có câu bị cắt. Phó từ, tự/tha động từ và phó từ với mẫu câu đặc định không có ví dụ trong PDF nguồn; chỉ giữ lemma, nghĩa hoặc collocation được cung cấp.

`exam-tips.json` đã mở trong danh mục với đủ 84 body không rỗng. Bộ động từ phức có đủ 78 mục trong dữ liệu được cung cấp, gồm 結びつける. Phase C chỉ áp dụng JSON được cung cấp, không trích xuất lại PDF/mixed/ebook/sổ tay và không công bố `_work`.

Đáp án practice v8 chỉ chấm khi JSON có key được đối chiếu. Bộ đồng nghĩa dùng 30/30 đáp án visual; bộ câu hỏi khó đã bỏ các đáp án đoán linguistic và không chấm khi `correct_answer == null`. 96 câu Hán tự, 50 câu cách dùng từ và 70 câu từ gần nghĩa giữ đáp án visual hiện có. Nguồn visual không đồng nghĩa với đáp án chính thức của JLPT.

Furigana v5 dùng các đoạn ruby được cung cấp trong JSON, với nguồn/cách đọc `linguistic`, không phải đáp án hay cách đọc chính thức từ kỳ thi. Vocabulary dùng `lemma_ruby`/`example_ruby`; grammar dùng `pattern_ruby`/`example_ruby`; reading dùng `connector_ruby` và `example_ruby` khi có. Practice dùng `stem_ruby`, hoặc `lemma_ruby` cho câu hỏi chỉ có từ vựng. Riêng trắc nghiệm Hán tự (`kanji-quiz`), từ gạch chân không hiển thị furigana để tránh lộ đáp án; các phần khác của câu vẫn giữ cách đọc. Target được đánh dấu trên chữ gốc bên trong ruby, không đánh dấu nhầm cách đọc; target qua nhiều đoạn ruby vẫn giữ đủ phần gạch chân.

Chỉ dựng furigana khi các đoạn text khớp nguyên văn; dữ liệu không khớp được hiển thị bằng văn bản gốc và fallback cách đọc riêng khi có. Một số `pattern_ruby` của Ebook chưa khớp pattern, nên vẫn dùng fallback này; giữ nguyên dữ liệu nguồn. Không tự sinh furigana ở client. Tips body và thẻ kanji giữ cách hiển thị hiện có.

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
| `study-data/topics.json`, `study-data/*.json` | Mục lục và 18 bộ dữ liệu học; metadata nguồn được giữ để đối chiếu. |
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


Tài nguyên trang study dùng phiên bản URL đồng bộ: `study.js?v=31`, `study.css?v=31` và JSON `?v=31`. Script lấy phiên bản từ URL module và truyền sang các lần tải JSON; cache offline lưu đúng các URL này để tránh trộn mã và dữ liệu của bản cũ. Khi phát hành thay đổi study tiếp theo, tăng phiên bản trong `study.html`, fallback `DATA_VERSION` và các URL trong `ASSETS` cùng với `CACHE`.

Giới hạn dữ liệu v8: 3 câu chưa có tóm tắt và 1 lựa chọn chưa có nghĩa VI riêng; các lý do đúng/sai vẫn được hiển thị theo JSON. Ứng dụng không tự bổ sung những trường này.

Tiến độ các bộ practice được lưu trong localStorage của trình duyệt: đếm Đúng/Sai/Còn, lọc Tất cả/Chưa làm/Câu sai/Câu đúng, làm lại riêng câu sai hoặc xóa tiến độ bộ hiện tại. Không đồng bộ lên server; hard-quiz không chấm điểm.

Sau khi trả lời câu hỏi có đáp án, nút “Xem giải thích” mở modal phân tích từng lựa chọn; đóng bằng nút Đóng, phím Escape hoặc chạm nền bên ngoài. Thanh tiến độ và bộ lọc nằm trong header cố định khi cuộn; mobile dùng bố cục gọn, các thao tác làm lại/xóa nằm trong menu ⋯.
