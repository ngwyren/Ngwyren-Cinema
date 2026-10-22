# Ngwyren Cinema (v2.0.0)

Website xem phim trực tuyến giao diện **Minimalist Monochrome (Đen & Trắng)** lấy cảm hứng từ **Apple TV / Apple Music Liquid Glass UI**, kết hợp tính năng gợi ý **Nội Dung Tương Tự (Netflix More Like This)** và trình phát đa nguồn **4K UHD / 2K QHD / 1080p HLS (.m3u8) & Embed Vietsub**.

- **Trải nghiệm trực tiếp (Live Web)**: [https://ngwyren.github.io/Ngwyren-Cinema/](https://ngwyren.github.io/Ngwyren-Cinema/)
- **Tải bản cài đặt / Release**: [GitHub Releases](https://github.com/ngwyren/Ngwyren-Cinema/releases)

## Tính năng nổi bật (v2.0.0)
- **Apple TV Liquid Glass & 3D Parallax**: Hiệu ứng kính lỏng phản quang đa lớp (Specular Rim Light), nghiêng 3D Parallax và ánh sáng lướt theo con trỏ chuột mượt 60/120fps bằng GPU.
- **Tuỳ chỉnh chất lượng 4K UHD / 2K QHD / 1080p / 720p / Auto**: Bộ chọn độ phân giải trực tiếp trên trình phát kèm bộ lọc quang học sắc nét **4K / 2K Cinema Clarity** và khóa mức bitrate HLS cao nhất.
- **Kho phim 1.767+ bộ (Bao gồm 320+ Anime & Phim Netflix Vietsub)**: Tích hợp sẵn dữ liệu hơn 1.767 bộ phim điện ảnh, phim bộ, Netflix Originals và hơn 320 bộ Anime Nhật Bản chọn lọc (*One Piece*, *Naruto*, *Bleach*, *Dragon Ball*, *Attack on Titan*, *Demon Slayer*, *Jujutsu Kaisen*, *Solo Leveling*, *Conan*, *Doraemon*...) cùng cơ chế tự động đồng bộ ngầm.
- **Đa nguồn phát Vietsub & Lồng Tiếng**: Hỗ trợ chuyển đổi tức thì giữa `Netflix Vietsub #1 (HLS)`, `Vietsub #2 (Embed FHD)`, `Vietsub #3 (StreamC)` và `Lồng Tiếng / Thuyết Minh`.
- **Tương thích hoàn hảo Điện thoại, iPad & Máy tính bảng**: Tích hợp thanh **Liquid Glass Bottom Dock** trên Mobile/iPad, lưới phim tự động co giãn và rạp phim dạng Bottom Sheet.

## Cấu trúc thư mục
- `index.html` — Giao diện chính Ngwyren Cinema
- `favicon.svg` — Biểu tượng Monochrome Ngwyren Cinema
- `css/style.css` — Hệ thống giao diện Monochrome Black & White, Apple TV Liquid Glass & Responsive Mobile/iPad
- `js/movies-catalog.js` — Cơ sở dữ liệu 1.767+ bộ phim & Anime khởi chạy tức thì (0ms)
- `js/data.js` — Bộ nạp dữ liệu đa nguồn (Netflix, KKPhim, NguonC, WP API) và gợi ý phim liên quan
- `js/app.js` — Bộ điều khiển giao diện, trình phát 4K/2K HLS và hiệu ứng 3D Parallax
- `Run-Ngwyren-Cinema-App.bat` — File khởi chạy nhanh ứng dụng dạng cửa sổ Desktop App
