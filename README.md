# Ngwyren Cinema

Website xem phim trực tuyến giao diện **Minimalist Monochrome (Đen & Trắng)** lấy cảm hứng từ **Apple Music UI** kết hợp tính năng gợi ý **Nội Dung Tương Tự (Netflix More Like This)** và trình phát **HLS (.m3u8) Full HD**.

## Tính năng nổi bật
- **Giao diện Minimalist Đen & Trắng**: Toàn bộ hệ thống màu sắc, glassmorphism, nút bấm và bộ icon đồng bộ sắc trắng tinh giản trên nền đen sâu.
- **Motion Graphics Ease-In-Out**: Chuyển động mượt mà theo đường cong `cubic-bezier` chuẩn Apple.
- **Đồng bộ toàn bộ kho phim**: Tự động tải và cập nhật danh sách phim mới nhất từ nhiều trang dữ liệu cùng đầy đủ tập phim phát trực tiếp qua HLS.js.
- **Tìm kiếm tức thì & Nội dung liên quan**: Gợi ý phim tương tự theo thể loại, quốc gia, đạo diễn và diễn viên.

## Cấu trúc thư mục
- `index.html` — Giao diện chính Ngwyren Cinema
- `css/style.css` — Hệ thống giao diện Monochrome Black & White và hiệu ứng chuyển động
- `js/data.js` — Bộ nạp dữ liệu phim và đồng bộ tập phim HLS
- `js/app.js` — Bộ điều khiển giao diện, trình phát video và tìm kiếm
