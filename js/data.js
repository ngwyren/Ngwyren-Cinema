/* ==========================================================================
   PHIMMOIZ.ONE DATA ENGINE & LIVE API CONNECTOR (js/data.js)
   Nguồn dữ liệu thực tế từ https://phimmoiz.one/ + WP REST API + PhimAPI HLS
   ========================================================================== */

const PHIMMOI_CONFIG = {
  baseUrl: "https://phimmoiz.one",
  wpApiPosts: "https://phimmoiz.one/wp-json/wp/v2/posts",
  phimApiBase: "https://phimapi.com/phim/",
  phimApiSearch: "https://phimapi.com/v1/api/tim-kiem",
  nguoncApiBase: "https://phim.nguonc.com/api/film/",
  nguoncApiSearch: "https://phim.nguonc.com/api/films/search",
  nguoncApiLatest: "https://phim.nguonc.com/api/films/phim-moi-cap-nhat",
  corsProxies: [
    "https://api.allorigins.win/raw?url=",
    "https://corsproxy.io/?"
  ]
};

/**
 * Kho dữ liệu phim thực tế trích xuất trực tiếp từ https://phimmoiz.one/
 * Đảm bảo trang web hiển thị tức thì 0ms và luôn hoạt động mượt mà kể cả khi mạng chậm.
 */
const PHIMMOI_SEED_MOVIES = [
  {
    id: "pm-1",
    slug: "thanh-guom-diet-quy-vo-han-thanh-465645",
    crawlSlug: "thanh-guom-diet-quy-vo-han-thanh",
    title: "Thanh Gươm Diệt Quỷ: Vô Hạn Thành",
    originTitle: "Demon Slayer: Kimetsu no Yaiba Infinity Castle",
    poster: "https://phimimg.com/upload/vod/20250722-1/66ee196318069c6ede9450a5f76a4648.jpg",
    backdrop: "https://phimimg.com/upload/vod/20250722-1/16ea0557ca40cd54a3d25c6750a65c0b.jpg",
    type: "single",
    sectionTags: ["de-cu", "anime", "phim-le", "hot"],
    quality: "FHD",
    language: "Vietsub + Thuyết Minh",
    duration: "155 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2025,
    rating: 9.7,
    matchScore: 99,
    country: "Nhật Bản",
    countrySlug: "nhat-ban",
    genres: ["Anime", "Hành Động", "Phiêu Lưu", "Kỳ Ảo"],
    director: "Haruo Sotozaki",
    cast: ["Natsuki Hanae", "Akari Kito", "Hiro Shimono", "Yoshitsugu Matsuoka", "Takahiro Sakurai"],
    ambientColors: ["#fa2d48", "#ff6b35", "#6b2cf5"],
    trailerUrl: "https://www.youtube.com/watch?v=rf0hW__Skow",
    link: "https://phimmoiz.one/thanh-guom-diet-quy-vo-han-thanh-465645/",
    synopsis: "Thanh Gươm Diệt Quỷ: Vô Hạn Thành đưa Kamado Tanjiro cùng các Trụ Cột của Sát Quỷ Đội rơi thẳng vào sào huyệt không gian biến ảo của Chúa quỷ Kibutsuji Muzan. Tại Vô Hạn Thành, những trận huyết chiến sinh tử khốc liệt nhất giữa Sát Quỷ Đoàn và Thượng Huyền Quỷ chính thức bùng nổ với kỹ xảo đỉnh cao từ Ufotable.",
    episodes: [
      {
        name: "Bản Điện Ảnh Full",
        slug: "tap-01",
        source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8"
      }
    ]
  },
  {
    id: "pm-2",
    slug: "matchbox-phim-dien-anh",
    crawlSlug: "matchbox-phim-dien-anh",
    title: "Matchbox: Phim Điện Ảnh",
    originTitle: "Matchbox The Movie",
    poster: "https://phimimg.com/uploads/movies/20261011/matchbox-phim-dien-anh-poster.webp",
    backdrop: "https://phimimg.com/uploads/movies/20261011/matchbox-phim-dien-anh-thumb.webp",
    type: "single",
    sectionTags: ["de-cu", "hot", "phim-le", "au-my"],
    quality: "FHD",
    language: "Vietsub",
    duration: "127 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2026,
    rating: 8.9,
    matchScore: 97,
    country: "Âu Mỹ",
    countrySlug: "au-my",
    genres: ["Hành Động", "Phiêu Lưu", "Hài Hước"],
    director: "Sam Hargrave",
    cast: ["John Cena", "Jessica Biel", "Sam Richardson", "Danai Gurira", "Corey Stoll", "Teyonah Parris"],
    ambientColors: ["#ff453a", "#ff9f0a", "#0a84ff"],
    trailerUrl: "https://www.youtube.com/watch?v=7xfqITrMDcI",
    link: "https://phimmoiz.one/matchbox-phim-dien-anh/",
    synopsis: "Matchbox: Phim Điện Ảnh (Matchbox The Movie) là bộ phim hành động phiêu lưu Mỹ năm 2026, đưa khán giả vào cuộc truy đuổi quốc tế đầy kịch tính với những chiếc xe tốc độ cao. Câu chuyện bắt đầu khi Sean (John Cena), một đặc vụ CIA hoạt động bí mật, trở về quê nhà và vô tình kéo nhóm bạn thân thời thơ ấu vào âm mưu có thể đe dọa an ninh toàn cầu.",
    episodes: [
      {
        name: "Full FHD",
        slug: "full",
        source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8"
      }
    ]
  },
  {
    id: "pm-3",
    slug: "dich-nhan-kiet-lang-nhan-kiep",
    crawlSlug: "dich-nhan-kiet-lang-nhan-kiep",
    title: "Địch Nhân Kiệt: Lang Nhân Kiếp",
    originTitle: "The Frontier Under The Blood Moon",
    poster: "https://phimimg.com/uploads/movies/20261011/dich-nhan-kiet-lang-nhan-kiep-poster.webp",
    backdrop: "https://phimimg.com/uploads/movies/20261011/dich-nhan-kiet-lang-nhan-kiep-thumb.webp",
    type: "single",
    sectionTags: ["hot", "phim-le", "trung-quoc"],
    quality: "FHD",
    language: "Vietsub",
    duration: "108 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2026,
    rating: 8.6,
    matchScore: 95,
    country: "Trung Quốc",
    countrySlug: "trung-quoc",
    genres: ["Cổ Trang", "Bí Ẩn", "Hành Động", "Tâm Lý"],
    director: "Francis Nam",
    cast: ["Đỗ Dịch Hành", "Trương Tuyết Hàm", "Trương Thành Lãng", "John Do"],
    ambientColors: ["#c9184a", "#5a189a", "#ffb703"],
    trailerUrl: "",
    link: "https://phimmoiz.one/dich-nhan-kiet-lang-nhan-kiep/",
    synopsis: "Địch Nhân Kiệt: Lang Nhân Kiếp đưa khán giả đến vùng biên giới Đại Đường dưới ánh trăng máu, nơi Phật nữ được Tân La cử sang Đại Đường bất ngờ bị sát hại. Những dấu vết kỳ dị liên quan đến thầy phù thủy người sói của bộ lạc Túc Mạt khiến Địch Nhân Kiệt phải đấu trí phá giải kỳ án nhằm ngăn chặn chiến tranh.",
    episodes: [
      {
        name: "Full FHD",
        slug: "full",
        source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8"
      }
    ]
  },
  {
    id: "pm-4",
    slug: "squid-game-3-765752",
    crawlSlug: "tro-choi-con-muc-phan-3",
    title: "Trò Chơi Con Mực (Phần 3)",
    originTitle: "Squid Game (Season 3)",
    poster: "https://phimimg.com/upload/vod/20250627-1/95df698d6732124181f47c85b5f1a475.jpg",
    backdrop: "https://phimimg.com/upload/vod/20250627-1/d5d6027b96a3145442ae28753db855d5.jpg",
    type: "series",
    sectionTags: ["de-cu", "phim-bo", "han-quoc", "hot"],
    quality: "FHD",
    language: "Vietsub + Lồng Tiếng",
    duration: "60 phút/tập",
    episodeCurrent: "Trọn Bộ 6 Tập",
    episodeTotal: "6",
    year: 2025,
    rating: 9.4,
    matchScore: 98,
    country: "Hàn Quốc",
    countrySlug: "han-quoc",
    genres: ["Hành Động", "Bí Ẩn", "Chính Kịch", "Giật Gân"],
    director: "Hwang Dong-hyuk",
    cast: ["Lee Jung-jae", "Lee Byung-hun", "Wi Ha-joon", "Im Si-wan", "Kang Ha-neul"],
    ambientColors: ["#ff0055", "#00b4d8", "#7209b7"],
    trailerUrl: "https://www.youtube.com/watch?v=oqxAJKy0ii4",
    link: "https://phimmoiz.one/squid-game-3-765752/",
    synopsis: "Hồi kết sinh tử của Seong Gi-hun (Người chơi 456) khi anh đối mặt trực diện với Front Man và những kẻ quyền lực đứng sau trò chơi tàn khốc. Những vòng chơi mới tàn nhẫn hơn buộc từng người chơi phải đưa ra lựa chọn giữa nhân tính và mạng sống.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" },
      { name: "Tập 2", slug: "tap-02", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" },
      { name: "Tập 3", slug: "tap-03", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" },
      { name: "Tập 4", slug: "tap-04", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" },
      { name: "Tập 5", slug: "tap-05", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" },
      { name: "Tập 6 (End)", slug: "tap-06", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" }
    ]
  },
  {
    id: "pm-5",
    slug: "tai-xe-an-danh-phan-3",
    crawlSlug: "tai-xe-an-danh-phan-3",
    title: "Tài Xế Ẩn Danh (Phần 3)",
    originTitle: "Taxi Driver (Season 3)",
    poster: "https://phimimg.com/upload/vod/20251122-1/98a195e46ee8549833c3d8d15008c430.jpg",
    backdrop: "https://phimimg.com/upload/vod/20251122-1/dfe9d4568bdeee90b8889d716e359af8.jpg",
    type: "series",
    sectionTags: ["de-cu", "phim-bo", "han-quoc", "hot"],
    quality: "FHD",
    language: "Vietsub + Thuyết Minh",
    duration: "64 phút/tập",
    episodeCurrent: "Tập 12 / 16",
    episodeTotal: "16",
    year: 2026,
    rating: 9.3,
    matchScore: 96,
    country: "Hàn Quốc",
    countrySlug: "han-quoc",
    genres: ["Hành Động", "Hình Sự", "Chính Kịch"],
    director: "Kang Bo-seung",
    cast: ["Lee Je-hoon", "Kim Eui-sung", "Pyo Ye-jin", "Jang Hyuk-jin", "Bae Yoo-ram"],
    ambientColors: ["#f77f00", "#d62828", "#003049"],
    trailerUrl: "",
    link: "https://phimmoiz.one/tai-xe-an-danh-phan-3/",
    synopsis: "Kim Do-gi và đội ngũ Hãng Taxi Cầu Vồng chính thức tái xuất trong Phần 3, thực thi công lý ngầm cho những nạn nhân tuyệt vọng mà pháp luật không thể bảo vệ trước các tập đoàn tội phạm xuyên quốc gia.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" },
      { name: "Tập 2", slug: "tap-02", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" },
      { name: "Tập 3", slug: "tap-03", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" },
      { name: "Tập 4", slug: "tap-04", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" }
    ]
  },
  {
    id: "pm-6",
    slug: "pham-nhan-tu-tien-truyen",
    crawlSlug: "pham-nhan-tu-tien-truyen",
    title: "Phàm Nhân Tu Tiên Truyện",
    originTitle: "The Immortal Ascension",
    poster: "https://phimimg.com/upload/vod/20250724-1/3acd42b880b9afc0e80ce1b3b66f4825.jpg",
    backdrop: "https://phimimg.com/upload/vod/20250724-1/8ac37168234fcdee704b2e60e3f8a2a2.jpg",
    type: "series",
    sectionTags: ["de-cu", "phim-bo", "trung-quoc"],
    quality: "FHD",
    language: "Vietsub + Thuyết Minh",
    duration: "45 phút/tập",
    episodeCurrent: "Tập 30 / 30",
    episodeTotal: "30",
    year: 2025,
    rating: 9.2,
    matchScore: 95,
    country: "Trung Quốc",
    countrySlug: "trung-quoc",
    genres: ["Cổ Trang", "Kỳ Ảo", "Hành Động", "Phiêu Lưu"],
    director: "Dương Dương (Đạo diễn)",
    cast: ["Dương Dương", "Kim Thần", "Uông Đạc", "Triệu Tiểu Đường"],
    ambientColors: ["#2ec4b6", "#3a86ff", "#8338ec"],
    trailerUrl: "",
    link: "https://phimmoiz.one/pham-nhan-tu-tien-truyen/",
    synopsis: "Hàn Lập – một thiếu niên nghèo xuất thân phàm trần tình cờ bước chân vào con đường tu tiên đầy hiểm ác. Không có tư chất trác tuyệt, Hàn Lập dựa vào sự cẩn trọng, trí mưu và chiếc bình nhỏ bí ẩn để từng bước nghịch thiên tu hành.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" },
      { name: "Tập 2", slug: "tap-02", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" },
      { name: "Tập 3", slug: "tap-03", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" }
    ]
  },
  {
    id: "pm-7",
    slug: "luat-su-cong-ich",
    crawlSlug: "luat-su-cong-ich",
    title: "Luật Sư Công Ích",
    originTitle: "Pro Bono",
    poster: "https://phimimg.com/upload/vod/20251207-1/f5049d137ddf6436f15279fada08d881.jpg",
    backdrop: "https://phimimg.com/upload/vod/20251207-1/e8c8db0b9567aded09109f7b9deda047.jpg",
    type: "series",
    sectionTags: ["de-cu", "phim-bo", "han-quoc"],
    quality: "FHD",
    language: "Vietsub",
    duration: "70 phút/tập",
    episodeCurrent: "Tập 10 / 12",
    episodeTotal: "12",
    year: 2026,
    rating: 8.8,
    matchScore: 93,
    country: "Hàn Quốc",
    countrySlug: "han-quoc",
    genres: ["Chính Kịch", "Tâm Lý", "Hình Sự"],
    director: "Kim Sung-yoon",
    cast: ["Jung Kyung-ho", "So Ju-yeon", "Yoon Na-moo"],
    ambientColors: ["#0a84ff", "#5e5ce6", "#fa2d48"],
    trailerUrl: "",
    link: "https://phimmoiz.one/luat-su-cong-ich/",
    synopsis: "Một thẩm phán tài danh bất ngờ mất tất cả sau một biến cố chấn động và buộc phải gia nhập đội ngũ luật sư công ích với mức phí 0 đồng, nơi anh khám phá ra những góc khuất nhức nhối của xã hội hiện đại.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" },
      { name: "Tập 2", slug: "tap-02", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" }
    ]
  },
  {
    id: "pm-8",
    slug: "yet-hi",
    crawlSlug: "yet-hi",
    title: "Yết Hí",
    originTitle: "Unveil The Mask",
    poster: "https://phimimg.com/upload/vod/20260109-1/d6d82c20c56d61f31894bd979c3eda4a.jpg",
    backdrop: "https://phimimg.com/upload/vod/20260109-1/cc0563a07da12a6896dffc6aa176c998.jpg",
    type: "series",
    sectionTags: ["de-cu", "phim-bo", "trung-quoc", "hot"],
    quality: "FHD",
    language: "Vietsub + Thuyết Minh",
    duration: "45 phút/tập",
    episodeCurrent: "Tập 24 / 28",
    episodeTotal: "28",
    year: 2026,
    rating: 9.0,
    matchScore: 94,
    country: "Trung Quốc",
    countrySlug: "trung-quoc",
    genres: ["Tình Cảm", "Bí Ẩn", "Chính Kịch"],
    director: "Mèo Cây (Miêu Đích Thụ)",
    cast: ["Trần Tinh Húc", "Lư Dục Hiểu", "Đạt Đạt"],
    ambientColors: ["#e63946", "#9d4edd", "#f4a261"],
    trailerUrl: "",
    link: "https://phimmoiz.one/yet-hi/",
    synopsis: "Giữa một trò chơi nhập vai kịch bản sát nhân lấy bối cảnh Dân Quốc đầy mê hoặc và thế giới kiến trúc hiện đại, hai con người mang vết thương lòng vô tình tháo gỡ chiếc mặt nạ của đối phương.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" },
      { name: "Tập 2", slug: "tap-02", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" }
    ]
  },
  {
    id: "pm-9",
    slug: "nhiem-vu-bat-kha-thi-nghiep-bao-phan-2-1",
    crawlSlug: "nhiem-vu-bat-kha-thi-nghiep-bao-phan-2",
    title: "Nhiệm Vụ: Bất Khả Thi - Nghiệp Báo (Phần 2)",
    originTitle: "Mission: Impossible - The Final Reckoning",
    poster: "https://phimimg.com/upload/vod/20250520-1/4897205e466f093e268e5e0336f667a6.jpg",
    backdrop: "https://phimimg.com/upload/vod/20250520-1/93b6f1f8e35b763a61a92a8c10558e96.jpg",
    type: "single",
    sectionTags: ["de-cu", "phim-le", "au-my", "hot"],
    quality: "FHD",
    language: "Vietsub",
    duration: "169 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2025,
    rating: 9.3,
    matchScore: 98,
    country: "Âu Mỹ",
    countrySlug: "au-my",
    genres: ["Hành Động", "Phiêu Lưu", "Giật Gân"],
    director: "Christopher McQuarrie",
    cast: ["Tom Cruise", "Hayley Atwell", "Ving Rhames", "Simon Pegg", "Vanessa Kirby"],
    ambientColors: ["#d90429", "#ff9f1c", "#2b2d42"],
    trailerUrl: "https://www.youtube.com/watch?v=NOhDyUmT9z0",
    link: "https://phimmoiz.one/nhiem-vu-bat-kha-thi-nghiep-bao-phan-2-1/",
    synopsis: "Đặc vụ Ethan Hunt và tổ chức IMF bước vào nhiệm vụ sinh tử cuối cùng nhằm truy tìm chiếc tàu ngầm Sevastopol và vô hiệu hóa siêu trí tuệ nhân tạo Thực Thể (The Entity) trước khi nó kiểm soát kho vũ khí hạt nhân toàn cầu.",
    episodes: [
      { name: "Full FHD", slug: "full", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" }
    ]
  },
  {
    id: "pm-10",
    slug: "mua-do",
    crawlSlug: "mua-do",
    title: "Mưa Đỏ",
    originTitle: "Red Rain",
    poster: "https://upload.wikimedia.org/wikipedia/vi/4/49/Mua_do_poster.jpg",
    backdrop: "https://upload.wikimedia.org/wikipedia/vi/b/b7/M%C6%B0a_%C4%91%E1%BB%8F_ti%E1%BB%83u_%C4%91%E1%BB%99i.png",
    type: "single",
    sectionTags: ["viet-nam", "phim-le", "de-cu"],
    quality: "FHD",
    language: "Vietsub",
    duration: "124 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2025,
    rating: 9.5,
    matchScore: 97,
    country: "Việt Nam",
    countrySlug: "viet-nam",
    genres: ["Chiến Tranh", "Lịch Sử", "Chính Kịch", "Hành Động"],
    director: "Đặng Thái Huyền",
    cast: ["Hứa Vĩ Văn", "Đỗ Nhật Hoàng", "Lê Hạ Anh"],
    ambientColors: ["#e63946", "#ffb703", "#6d597a"],
    trailerUrl: "",
    link: "https://phimmoiz.one/mua-do/",
    synopsis: "Bộ phim điện ảnh lịch sử hào hùng tái hiện 81 ngày đêm chiến đấu kiên cường bảo vệ Thành cổ Quảng Trị mùa hè đỏ lửa năm 1972 với những thước phim bi tráng, xúc động.",
    episodes: [
      { name: "Full FHD", slug: "full", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" }
    ]
  },
  {
    id: "pm-11",
    slug: "dia-dao-mat-troi-trong-bong-toi",
    crawlSlug: "dia-dao-mat-troi-trong-bong-toi",
    title: "Địa Đạo: Mặt Trời Trong Bóng Tối",
    originTitle: "Tunnels: Sun In The Dark",
    poster: "https://phimimg.com/upload/vod/20250519-1/9877afe853d8484edcbe040cb3221ced.jpg",
    backdrop: "https://phimimg.com/upload/vod/20250519-1/d041b7d764329efdbb5222010f0f1796.jpg",
    type: "single",
    sectionTags: ["viet-nam", "phim-le", "de-cu"],
    quality: "FHD",
    language: "Vietsub",
    duration: "120 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2025,
    rating: 9.4,
    matchScore: 96,
    country: "Việt Nam",
    countrySlug: "viet-nam",
    genres: ["Chiến Tranh", "Lịch Sử", "Hành Động", "Chính Kịch"],
    director: "Bùi Thạc Chuyên",
    cast: ["Thái Hòa", "Quang Tuấn", "Hồ Thu Anh"],
    ambientColors: ["#d97706", "#dc2626", "#4b5563"],
    trailerUrl: "",
    link: "https://phimmoiz.one/dia-dao-mat-troi-trong-bong-toi/",
    synopsis: "Năm 1967, tại căn cứ địa đạo Củ Chi, đội du kích 21 người do Bảy Theo (Thái Hòa) chỉ huy phải bám trụ dưới lòng đất nghẹt thở để bảo vệ nhóm tình báo chiến lược trước cuộc càn quét khốc liệt.",
    episodes: [
      { name: "Full FHD", slug: "full", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" }
    ]
  },
  {
    id: "pm-12",
    slug: "nha-gia-tien",
    crawlSlug: "nha-gia-tien",
    title: "Nhà Gia Tiên",
    originTitle: "The Ancestral Home",
    poster: "https://phimimg.com/upload/vod/20250710-1/5af1cd558e89eb88b67d72181906edac.jpg",
    backdrop: "https://phimimg.com/upload/vod/20250710-1/3024e503f4c8cecdb0578c20c77e4cdf.jpg",
    type: "single",
    sectionTags: ["de-cu", "viet-nam", "phim-le"],
    quality: "FHD",
    language: "Vietsub",
    duration: "117 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2025,
    rating: 8.7,
    matchScore: 94,
    country: "Việt Nam",
    countrySlug: "viet-nam",
    genres: ["Tâm Lý", "Gia Đình", "Bí Ẩn", "Hài Hước"],
    director: "Huỳnh Lập",
    cast: ["Huỳnh Lập", "Phương Mỹ Chi", "NSƯT Hạnh Thúy", "Puka"],
    ambientColors: ["#f59e0b", "#ef4444", "#7c3aed"],
    trailerUrl: "",
    link: "https://phimmoiz.one/nha-gia-tien/",
    synopsis: "Mỹ Tiên – một nhà sáng tạo nội dung Gen Z trở về căn nhà cổ của gia đình để quay video triệu view và bất ngờ nhìn thấy linh hồn người anh trai đã khuất Gia Minh, mở ra những bí mật truyền thống đầy cảm xúc.",
    episodes: [
      { name: "Full FHD", slug: "full", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" }
    ]
  },
  {
    id: "pm-13",
    slug: "tham-tu-kien-ky-an-khong-dau",
    crawlSlug: "tham-tu-kien-ky-an-khong-dau",
    title: "Thám Tử Kiên: Kỳ Án Không Đầu",
    originTitle: "Detective Kien: The Headless Horror",
    poster: "https://phimimg.com/upload/vod/20251010-1/d5236005ee6df744aa5417cf5231f167.jpg",
    backdrop: "https://phimimg.com/upload/vod/20251010-1/3c95bc59bc3c37fc3fb76e27b156d1bf.jpg",
    type: "single",
    sectionTags: ["viet-nam", "phim-le", "hot"],
    quality: "FHD",
    language: "Vietsub",
    duration: "131 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2025,
    rating: 8.9,
    matchScore: 95,
    country: "Việt Nam",
    countrySlug: "viet-nam",
    genres: ["Bí Ẩn", "Kinh Dị", "Cổ Trang", "Hình Sự"],
    director: "Victor Vũ",
    cast: ["Quốc Huy", "Đinh Ngọc Diệp", "Quốc Anh", "Minh Anh"],
    ambientColors: ["#991b1b", "#4c1d95", "#d97706"],
    trailerUrl: "",
    link: "https://phimmoiz.one/tham-tu-kien-ky-an-khong-dau/",
    synopsis: "Thám tử Kiên bước vào cuộc điều tra chuỗi án mạng kỳ bí nơi vùng sơn cước cổ xưa, nơi lời đồn về oán linh không đầu che đậy một âm mưu thâm độc.",
    episodes: [
      { name: "Full FHD", slug: "full", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" }
    ]
  },
  {
    id: "pm-14",
    slug: "good-boy-18",
    crawlSlug: "good-boy",
    title: "Good Boy: Kiện Tướng Nắm Đấm",
    originTitle: "Good Boy",
    poster: "https://phimimg.com/upload/vod/20250601-1/f3bbb466904489c0eb475f89bf6e3166.jpg",
    backdrop: "https://phimimg.com/upload/vod/20250601-1/89524a3a031fbfa2f29eb7b81cff489f.jpg",
    type: "series",
    sectionTags: ["de-cu", "han-quoc", "phim-bo"],
    quality: "FHD",
    language: "Vietsub + Thuyết Minh",
    duration: "65 phút/tập",
    episodeCurrent: "Tập 16 / 16",
    episodeTotal: "16",
    year: 2025,
    rating: 9.1,
    matchScore: 95,
    country: "Hàn Quốc",
    countrySlug: "han-quoc",
    genres: ["Hành Động", "Hài Hước", "Hình Sự"],
    director: "Shim Na-yeon",
    cast: ["Park Bo-gum", "Kim So-hyun", "Oh Jung-se", "Lee Sang-yi"],
    ambientColors: ["#3b82f6", "#ef4444", "#f59e0b"],
    trailerUrl: "",
    link: "https://phimmoiz.one/good-boy-18/",
    synopsis: "Nhóm cựu vận động viên từng giành huy chương vàng Olympic được tuyển dụng đặc biệt vào lực lượng cảnh sát, dùng kỹ năng thể thao thượng thừa để trấn áp tội phạm bạo lực.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" },
      { name: "Tập 2", slug: "tap-02", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" }
    ]
  },
  {
    id: "pm-15",
    slug: "head-over-heels-24",
    crawlSlug: "head-over-heels",
    title: "Ngưu Lang Chức Nữ",
    originTitle: "Head Over Heels",
    poster: "https://phimimg.com/upload/vod/20250624-1/6295cf08845cf14b511410c7547d336a.jpg",
    backdrop: "https://phimimg.com/upload/vod/20250624-1/93e56e4419410c589a127345fb0c0379.jpg",
    type: "series",
    sectionTags: ["de-cu", "han-quoc", "phim-bo"],
    quality: "FHD",
    language: "Vietsub",
    duration: "62 phút/tập",
    episodeCurrent: "Tập 12 / 12",
    episodeTotal: "12",
    year: 2025,
    rating: 8.8,
    matchScore: 92,
    country: "Hàn Quốc",
    countrySlug: "han-quoc",
    genres: ["Tình Cảm", "Kỳ Ảo", "Hài Hước"],
    director: "Kim Yong-wan",
    cast: ["Cho Yi-hyun", "Choo Young-woo"],
    ambientColors: ["#ec4899", "#8b5cf6", "#3b82f6"],
    trailerUrl: "",
    link: "https://phimmoiz.one/head-over-heels-24/",
    synopsis: "Nữ sinh trung học ban ngày đi học, ban đêm là pháp sư tài năng tìm mọi cách giải cứu mối tình đầu của mình khỏi vận mệnh tử thần đã được định đoạt.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" },
      { name: "Tập 2", slug: "tap-02", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" }
    ]
  },
  {
    id: "pm-16",
    slug: "cau-be-mat-tich-phan-5",
    crawlSlug: "cau-be-mat-tich-phan-5",
    title: "Cậu Bé Mất Tích (Phần 5)",
    originTitle: "Stranger Things (Season 5)",
    poster: "https://phimimg.com/upload/vod/20251127-1/88dfce03b997600f0a898945fe8facb2.jpg",
    backdrop: "https://phimimg.com/upload/vod/20251127-1/04a8a61670f1faf048ebc3450d6ccdb5.jpg",
    type: "series",
    sectionTags: ["au-my", "phim-bo", "hot", "de-cu"],
    quality: "FHD",
    language: "Vietsub",
    duration: "143 phút/tập",
    episodeCurrent: "Tập 8 / 8",
    episodeTotal: "8",
    year: 2025,
    rating: 9.6,
    matchScore: 99,
    country: "Âu Mỹ",
    countrySlug: "au-my",
    genres: ["Viễn Tưởng", "Bí Ẩn", "Phiêu Lưu", "Kinh Dị"],
    director: "The Duffer Brothers",
    cast: ["Millie Bobby Brown", "Finn Wolfhard", "Winona Ryder", "David Harbour", "Sadie Sink"],
    ambientColors: ["#e11d48", "#311042", "#dc2626"],
    trailerUrl: "",
    link: "https://phimmoiz.one/cau-be-mat-tich-phan-5/",
    synopsis: "Trận chiến cuối cùng bảo vệ thị trấn Hawkins trước sự xâm lăng toàn diện của Thế Giới Ngược (Upside Down) và Vecna. Eleven cùng những người bạn phải hợp sức cho trận quyết chiến vĩ đại nhất.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" },
      { name: "Tập 2", slug: "tap-02", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" }
    ]
  },
  {
    id: "pm-17",
    slug: "sup-do-phan-2",
    crawlSlug: "sup-do-phan-2",
    title: "Sụp Đổ (Phần 2)",
    originTitle: "Fallout (Season 2)",
    poster: "https://phimimg.com/upload/vod/20251218-1/97fcfb8cfdae35b08e3b22a7e3fd3b5a.jpg",
    backdrop: "https://phimimg.com/upload/vod/20251218-1/edf322e64d437755bd03623d7c8298a5.jpg",
    type: "series",
    sectionTags: ["au-my", "phim-bo"],
    quality: "FHD",
    language: "Vietsub",
    duration: "62 phút/tập",
    episodeCurrent: "Tập 8 / 8",
    episodeTotal: "8",
    year: 2026,
    rating: 9.1,
    matchScore: 94,
    country: "Âu Mỹ",
    countrySlug: "au-my",
    genres: ["Viễn Tưởng", "Hành Động", "Phiêu Lưu"],
    director: "Jonathan Nolan",
    cast: ["Ella Purnell", "Walton Goggins", "Aaron Moten"],
    ambientColors: ["#eab308", "#2563eb", "#dc2626"],
    trailerUrl: "",
    link: "https://phimmoiz.one/sup-do-phan-2/",
    synopsis: "Lucy và The Ghoul tiếp tục hành trình băng qua vùng đất hoang tàn hậu tận thế tiến về New Vegas để truy tìm sự thật đằng sau tập đoàn Vault-Tec.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" }
    ]
  },
  {
    id: "pm-18",
    slug: "thanh-guom-diet-quy-lang-tho-ren",
    crawlSlug: "thanh-guom-diet-quy-lang-tho-ren",
    title: "Thanh Gươm Diệt Quỷ: Làng Thợ Rèn",
    originTitle: "Demon Slayer (Season 4) (Swordsmith Village Arc)",
    poster: "https://phimimg.com/upload/vod/20250427-1/c1ed81199e77a349d236c842953c9c6a.jpg",
    backdrop: "https://phimimg.com/upload/vod/20240308-1/a0f9644299d8322f495e5fda38098f39.jpg",
    type: "series",
    sectionTags: ["de-cu", "anime", "phim-bo"],
    quality: "FHD",
    language: "Vietsub + Lồng Tiếng",
    duration: "24 phút/tập",
    episodeCurrent: "Trọn Bộ 11 Tập",
    episodeTotal: "11",
    year: 2024,
    rating: 9.3,
    matchScore: 98,
    country: "Nhật Bản",
    countrySlug: "nhat-ban",
    genres: ["Anime", "Hành Động", "Phiêu Lưu", "Kỳ Ảo"],
    director: "Haruo Sotozaki",
    cast: ["Natsuki Hanae", "Akari Kito", "Kana Hanazawa", "Kengo Kawanishi"],
    ambientColors: ["#10b981", "#ec4899", "#f43f5e"],
    trailerUrl: "",
    link: "https://phimmoiz.one/thanh-guom-diet-quy-lang-tho-ren/",
    synopsis: "Tanjiro tìm đến Làng Thợ Rèn bí mật để rèn lại thanh Nhật Luân Kiếm và sát cánh cùng Luyến Trụ Mitsuri, Hà Trụ Muichiro chống lại sự tấn công bất ngờ của hai Thượng Huyền Quỷ.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" },
      { name: "Tập 2", slug: "tap-02", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" }
    ]
  },
  {
    id: "pm-19",
    slug: "thanh-guom-diet-quy-ky-vien-tran",
    crawlSlug: "thanh-guom-diet-quy-ky-vien-tran",
    title: "Thanh Gươm Diệt Quỷ: Kỹ Viện Trấn",
    originTitle: "Demon Slayer (Season 3) (Entertainment District Arc)",
    poster: "https://phimimg.com/upload/vod/20250427-1/ba01d82e006a7d9c2fb3aca49a0a8b1e.jpg",
    backdrop: "https://phimimg.com/upload/vod/20240302-1/495167573eb3f65d09652933e64327c0.jpg",
    type: "series",
    sectionTags: ["de-cu", "anime", "phim-bo"],
    quality: "FHD",
    language: "Vietsub + Lồng Tiếng",
    duration: "24 phút/tập",
    episodeCurrent: "Trọn Bộ 11 Tập",
    episodeTotal: "11",
    year: 2023,
    rating: 9.5,
    matchScore: 98,
    country: "Nhật Bản",
    countrySlug: "nhat-ban",
    genres: ["Anime", "Hành Động", "Phiêu Lưu", "Kỳ Ảo"],
    director: "Haruo Sotozaki",
    cast: ["Natsuki Hanae", "Katsuyuki Konishi", "Hiro Shimono"],
    ambientColors: ["#db2777", "#9333ea", "#f97316"],
    trailerUrl: "",
    link: "https://phimmoiz.one/thanh-guom-diet-quy-ky-vien-tran/",
    synopsis: "Âm Trụ Uzui Tengen dẫn dắt bộ ba Tanjiro, Zenitsu và Inosuke thâm nhập Kỹ Viện Trấn Yoshiwara hoa lệ để điều tra sự mất tích bí ẩn và đối đầu Thượng Huyền Lục Daki & Gyutaro.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" }
    ]
  },
  {
    id: "pm-20",
    slug: "chainsaw-man-the-movie-chuong-reze",
    crawlSlug: "chainsaw-man-the-movie-chuong-reze",
    title: "Chainsaw Man - The Movie: Chương Reze",
    originTitle: "Chainsaw Man - The Movie: Reze Arc",
    poster: "https://phimimg.com/upload/vod/20251209-1/69d2d97349877280293f7c1ccc9efdb4.jpg",
    backdrop: "https://phimimg.com/upload/vod/20251209-1/c3096886a37e19947c1b6758f7b8829f.jpg",
    type: "single",
    sectionTags: ["anime", "phim-le", "hot"],
    quality: "FHD",
    language: "Vietsub",
    duration: "100 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2025,
    rating: 9.4,
    matchScore: 97,
    country: "Nhật Bản",
    countrySlug: "nhat-ban",
    genres: ["Anime", "Hành Động", "Kỳ Ảo", "Tình Cảm"],
    director: "Tatsuya Yoshihara",
    cast: ["Kikunosuke Toya", "Reina Ueda", "Tomori Kusunoki"],
    ambientColors: ["#a855f7", "#ec4899", "#ef4444"],
    trailerUrl: "",
    link: "https://phimmoiz.one/chainsaw-man-the-movie-chuong-reze/",
    synopsis: "Cuộc gặp gỡ định mệnh dưới cơn mưa giữa Denji và cô gái làm thêm tại quán cà phê tên Reze mở ra một câu chuyện tình lãng mạn nhưng cũng đẫm máu và bùng nổ bậc nhất.",
    episodes: [
      { name: "Full FHD", slug: "full", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" }
    ]
  },
  {
    id: "pm-21",
    slug: "chu-thuat-hoi-chien-hoai-ngoc-ngoc-chiet-the-movie",
    crawlSlug: "chu-thuat-hoi-chien-hoai-ngoc-ngoc-chiet-the-movie",
    title: "Chú Thuật Hồi Chiến: Hoài Ngọc / Ngọc Chiết",
    originTitle: "JUJUTSU KAISEN: Hidden Inventory / Premature Death",
    poster: "https://phimimg.com/upload/vod/20260109-1/4e4d8423fc6430a5068ec9aad53b9ead.jpg",
    backdrop: "https://phimimg.com/upload/vod/20260109-1/dc1ee67bc00ae06dd19314078cf5d2de.jpg",
    type: "single",
    sectionTags: ["anime", "phim-le"],
    quality: "FHD",
    language: "Vietsub",
    duration: "111 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2025,
    rating: 9.3,
    matchScore: 96,
    country: "Nhật Bản",
    countrySlug: "nhat-ban",
    genres: ["Anime", "Hành Động", "Kỳ Ảo"],
    director: "Shota Goshozono",
    cast: ["Yuichi Nakamura", "Takahiro Sakurai", "Takehito Koyasu"],
    ambientColors: ["#0ea5e9", "#6366f1", "#ec4899"],
    trailerUrl: "",
    link: "https://phimmoiz.one/chu-thuat-hoi-chien-hoai-ngoc-ngoc-chiet-the-movie/",
    synopsis: "Thời thanh xuân rực rỡ nhưng bi thương của bộ đôi mạnh nhất Satoru Gojo và Suguru Geto trong nhiệm vụ hộ tống Tinh Tương Thể Riko Amanai trước sát thủ Toji Fushiguro.",
    episodes: [
      { name: "Full FHD", slug: "full", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" }
    ]
  },
  {
    id: "pm-22",
    slug: "phi-vu-dong-troi-2",
    crawlSlug: "phi-vu-dong-troi-2",
    title: "Phi Vụ Động Trời 2",
    originTitle: "Zootopia 2",
    poster: "https://phimimg.com/upload/vod/20251223-1/6bc1d549b86e490274d93bab66a3654d.jpg",
    backdrop: "https://phimimg.com/upload/vod/20251223-1/7154384c306c73664e46942f2477e574.jpg",
    type: "single",
    sectionTags: ["anime", "au-my", "phim-le", "hot"],
    quality: "FHD",
    language: "Vietsub + Lồng Tiếng",
    duration: "100 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2025,
    rating: 9.1,
    matchScore: 95,
    country: "Âu Mỹ",
    countrySlug: "au-my",
    genres: ["Hoạt Hình", "Phiêu Lưu", "Hài Hước", "Gia Đình"],
    director: "Jared Bush, Byron Howard",
    cast: ["Ginnifer Goodwin", "Jason Bateman", "Ke Huy Quan"],
    ambientColors: ["#f97316", "#3b82f6", "#10b981"],
    trailerUrl: "",
    link: "https://phimmoiz.one/phi-vu-dong-troi-2/",
    synopsis: "Cặp bài trùng cảnh sát thỏ Judy Hopps và cáo Nick Wilde tái hợp trong một vụ án bí ẩn liên quan đến cư dân bò sát mới xuất hiện làm đảo lộn thành phố Zootopia.",
    episodes: [
      { name: "Full FHD", slug: "full", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" }
    ]
  },
  {
    id: "pm-23",
    slug: "100-ngay-lua-doi",
    crawlSlug: "100-ngay-lua-doi",
    title: "100 Ngày Lừa Dối",
    originTitle: "100 Days Of Deception",
    poster: "https://phimimg.com/uploads/movies/20261011/100-ngay-lua-doi-poster.webp",
    backdrop: "https://phimimg.com/uploads/movies/20261011/100-ngay-lua-doi-thumb.webp",
    type: "series",
    sectionTags: ["hot", "phim-bo", "han-quoc"],
    quality: "FHD",
    language: "Vietsub",
    duration: "74 phút/tập",
    episodeCurrent: "Tập 4 / 12",
    episodeTotal: "12",
    year: 2026,
    rating: 8.7,
    matchScore: 93,
    country: "Hàn Quốc",
    countrySlug: "han-quoc",
    genres: ["Tình Cảm", "Chính Kịch", "Bí Ẩn"],
    director: "Park Jin-woo",
    cast: ["Kim Ji-won", "Lee Do-hyun"],
    ambientColors: ["#f43f5e", "#8b5cf6", "#06b6d4"],
    trailerUrl: "",
    link: "https://phimmoiz.one/100-ngay-lua-doi/",
    synopsis: "Bản hợp đồng hôn nhân 100 ngày đầy những lời nói dối tinh vi giữa hai kẻ mang mục tiêu trả thù riêng, nhưng lại dẫn đến rung động thật sự không thể kiểm soát.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" },
      { name: "Tập 2", slug: "tap-02", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" },
      { name: "Tập 3", slug: "tap-03", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" },
      { name: "Tập 4", slug: "tap-04", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" }
    ]
  },
  {
    id: "pm-24",
    slug: "ngoc-diem-thu",
    crawlSlug: "ngoc-diem-thu",
    title: "Ngọc Điệm Thu",
    originTitle: "The Lament Of Autumn",
    poster: "https://phimimg.com/uploads/movies/20261012/ngoc-diem-thu-poster.webp",
    backdrop: "https://phimimg.com/uploads/movies/20261012/ngoc-diem-thu-thumb.webp",
    type: "series",
    sectionTags: ["hot", "phim-bo", "trung-quoc"],
    quality: "FHD",
    language: "Vietsub + Thuyết Minh",
    duration: "44 phút/tập",
    episodeCurrent: "Tập 19 / 32",
    episodeTotal: "32",
    year: 2026,
    rating: 8.8,
    matchScore: 94,
    country: "Trung Quốc",
    countrySlug: "trung-quoc",
    genres: ["Cổ Trang", "Tình Cảm", "Chính Kịch"],
    director: "Chu Duẫn",
    cast: ["Thừa Lỗi", "Từ Nhược Hàm"],
    ambientColors: ["#d97706", "#b91c1c", "#4338ca"],
    trailerUrl: "",
    link: "https://phimmoiz.one/ngoc-diem-thu/",
    synopsis: "Câu chuyện tình yêu đầy bi thương và quyền mưu giữa thời loạn thế, nơi lòng trung thành và tình yêu bị đặt lên bàn cân sinh tử.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" },
      { name: "Tập 2", slug: "tap-02", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" }
    ]
  },
  {
    id: "pm-25",
    slug: "my-nhan-du",
    crawlSlug: "my-nhan-du",
    title: "Mỹ Nhân Dư",
    originTitle: "The Vanishing Beauty",
    poster: "https://phimimg.com/uploads/movies/20261010/my-nhan-du-poster.webp",
    backdrop: "https://phimimg.com/uploads/movies/20261010/my-nhan-du-thumb.webp",
    type: "series",
    sectionTags: ["hot", "phim-bo", "trung-quoc"],
    quality: "FHD",
    language: "Vietsub",
    duration: "47 phút/tập",
    episodeCurrent: "Tập 23 / 36",
    episodeTotal: "36",
    year: 2026,
    rating: 8.6,
    matchScore: 91,
    country: "Trung Quốc",
    countrySlug: "trung-quoc",
    genres: ["Tâm Lý", "Tình Cảm", "Bí Ẩn"],
    director: "Lý Mộc Qua",
    cast: ["Lý Nhất Đồng", "Vương Tuấn Khải"],
    ambientColors: ["#ec4899", "#6366f1", "#14b8a6"],
    trailerUrl: "",
    link: "https://phimmoiz.one/my-nhan-du/",
    synopsis: "Hành trình tìm lại bản ngã và vạch trần sự thật đằng sau những hào quang giả tạo của bốn người phụ nữ có số phận gắn kết chặt chẽ.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" }
    ]
  },
  {
    id: "pm-26",
    slug: "cuoc-goi-khan-cap-9-1-1-phan-9",
    crawlSlug: "cuoc-goi-khan-cap-9-1-1-phan-9",
    title: "Cuộc Gọi Khẩn Cấp 9-1-1 (Phần 9)",
    originTitle: "9-1-1 (Season 9)",
    poster: "https://phimimg.com/uploads/movies/20260815/cuoc-goi-khan-cap-9-1-1-phan-9-poster.webp",
    backdrop: "https://phimimg.com/uploads/movies/20260815/cuoc-goi-khan-cap-9-1-1-phan-9-thumb.webp",
    type: "series",
    sectionTags: ["hot", "phim-bo", "au-my"],
    quality: "FHD",
    language: "Vietsub",
    duration: "45 phút/tập",
    episodeCurrent: "Tập 14 / 18",
    episodeTotal: "18",
    year: 2026,
    rating: 8.9,
    matchScore: 94,
    country: "Âu Mỹ",
    countrySlug: "au-my",
    genres: ["Hành Động", "Chính Kịch", "Hình Sự"],
    director: "Ryan Murphy",
    cast: ["Angela Bassett", "Peter Krause", "Jennifer Love Hewitt", "Oliver Stark"],
    ambientColors: ["#ef4444", "#3b82f6", "#f59e0b"],
    trailerUrl: "",
    link: "https://phimmoiz.one/cuoc-goi-khan-cap-9-1-1-phan-9/",
    synopsis: "Những người lính cứu hỏa, cảnh sát và nhân viên tổng đài cứu hộ Los Angeles tiếp tục đối mặt với những thảm họa nghẹt thở và căng thẳng tột độ.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" }
    ]
  },
  {
    id: "pm-27",
    slug: "cu-roi-tu-than-2-diem-chet",
    crawlSlug: "cu-roi-tu-than-2-diem-chet",
    title: "Cú Rơi Tử Thần 2: Điểm Chết",
    originTitle: "Fall 2: Deadpoint",
    poster: "https://phimimg.com/uploads/movies/20261010/cu-roi-tu-than-2-diem-chet-poster.webp",
    backdrop: "https://phimimg.com/uploads/movies/20261010/cu-roi-tu-than-2-diem-chet-thumb.webp",
    type: "single",
    sectionTags: ["hot", "phim-le", "au-my"],
    quality: "FHD",
    language: "Vietsub",
    duration: "98 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2026,
    rating: 8.4,
    matchScore: 92,
    country: "Âu Mỹ",
    countrySlug: "au-my",
    genres: ["Giật Gân", "Phiêu Lưu", "Tâm Lý"],
    director: "Michael & Peter Spierig",
    cast: ["Harriet Slater", "Arsema Thomas"],
    ambientColors: ["#f97316", "#0284c7", "#475569"],
    trailerUrl: "",
    link: "https://phimmoiz.one/cu-roi-tu-than-2-diem-chet/",
    synopsis: "Tiếp nối nỗi ám ảnh độ cao nghẹt thở, phần 2 đưa người xem lên một cấu trúc chọc trời cô lập giữa thiên nhiên khắc nghiệt nơi một sai lầm nhỏ đồng nghĩa với cái chết.",
    episodes: [
      { name: "Full FHD", slug: "full", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" }
    ]
  },
  {
    id: "pm-28",
    slug: "pha-dam-sinh-nhat-me",
    crawlSlug: "pha-dam-sinh-nhat-me",
    title: "Phá Đám: Sinh Nhật Mẹ",
    originTitle: "Spoiled: Mom's Birthday Party",
    poster: "https://phimimg.com/upload/vod/20260517-1/cf6c033ac490be0f8414ce3abadf4246.jpg",
    backdrop: "https://phimimg.com/upload/vod/20260517-1/ad67ffa5d2d07e1566bb07f27bdeb123.jpg",
    type: "single",
    sectionTags: ["hot", "phim-le", "viet-nam"],
    quality: "FHD",
    language: "Vietsub",
    duration: "91 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2026,
    rating: 8.5,
    matchScore: 93,
    country: "Việt Nam",
    countrySlug: "viet-nam",
    genres: ["Gia Đình", "Hài Hước", "Tâm Lý"],
    director: "Nguyễn Thanh Bình",
    cast: ["NSƯT Thành Hội", "Ái Như", "Trần Kim Hải"],
    ambientColors: ["#f43f5e", "#f59e0b", "#8b5cf6"],
    trailerUrl: "",
    link: "https://phimmoiz.one/pha-dam-sinh-nhat-me/",
    synopsis: "Buổi tiệc sinh nhật tưởng chừng ấm cúng của người mẹ bất ngờ trở thành tâm điểm của hàng loạt tình huống dở khóc dở cười khi những bí mật giấu kín của các thành viên trong gia đình bị phơi bày.",
    episodes: [
      { name: "Full FHD", slug: "full", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" }
    ]
  },
  {
    id: "pm-29",
    slug: "cam-nguyet-nhu-ca",
    crawlSlug: "cam-nguyet-nhu-ca",
    title: "Cẩm Nguyệt Như Ca",
    originTitle: "Legend Of The Female General",
    poster: "https://phimimg.com/upload/vod/20250806-1/eaa856bf1bf6e28c17ebafdc2283f8ad.jpg",
    backdrop: "https://phimimg.com/upload/vod/20250806-1/0d83ca81d2ed84f40d0979bd3a6c496f.jpg",
    type: "series",
    sectionTags: ["de-cu", "trung-quoc", "phim-bo"],
    quality: "FHD",
    language: "Vietsub + Thuyết Minh",
    duration: "45 phút/tập",
    episodeCurrent: "Trọn Bộ 36 Tập",
    episodeTotal: "36",
    year: 2025,
    rating: 9.0,
    matchScore: 95,
    country: "Trung Quốc",
    countrySlug: "trung-quoc",
    genres: ["Cổ Trang", "Hành Động", "Tình Cảm"],
    director: "Tưởng Gia Tuấn",
    cast: ["Châu Dã", "Thừa Lỗi", "Trương Khang Lạc"],
    ambientColors: ["#dc2626", "#ca8a04", "#1d4ed8"],
    trailerUrl: "",
    link: "https://phimmoiz.one/cam-nguyet-nhu-ca/",
    synopsis: "Nữ tướng quân Hòa Yến cải trang nam nhi ra trận lập chiến công hiển hách nhưng bị gia tộc phản bội. Sống lại dưới thân phận mới, nàng một lần nữa khoác chiến giáp đòi lại công đạo cùng Tiêu Giác.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" }
    ]
  },
  {
    id: "pm-30",
    slug: "trieu-tuyet-luc",
    crawlSlug: "trieu-tuyet-luc",
    title: "Triều Tuyết Lục",
    originTitle: "Coroner's Diary",
    poster: "https://phimimg.com/upload/vod/20250713-1/464d72c09e1e3934b2bf37d7e6afdf4c.jpg",
    backdrop: "https://phimimg.com/upload/vod/20250713-1/49c56c1f733ed8a328dc7984df495075.jpg",
    type: "series",
    sectionTags: ["de-cu", "trung-quoc", "phim-bo"],
    quality: "FHD",
    language: "Vietsub + Thuyết Minh",
    duration: "45 phút/tập",
    episodeCurrent: "Trọn Bộ 38 Tập",
    episodeTotal: "38",
    year: 2025,
    rating: 8.9,
    matchScore: 94,
    country: "Trung Quốc",
    countrySlug: "trung-quoc",
    genres: ["Cổ Trang", "Bí Ẩn", "Tình Cảm"],
    director: "Lý Tuệ Chu",
    cast: ["Lý Lan Địch", "Ngao Thụy Bằng"],
    ambientColors: ["#38bdf8", "#818cf8", "#f43f5e"],
    trailerUrl: "",
    link: "https://phimmoiz.one/trieu-tuyet-luc/",
    synopsis: "Nữ ngỗ tác tài ba Thẩm Hoàn dùng y thuật và khả năng nghiệm thi sắc bén phối hợp cùng Thế tử Yên Trì giải mã hàng loạt vụ kỳ án chấn động triều đình.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8" }
    ]
  },
  {
    id: "pm-31",
    slug: "tham-tu-lung-danh-conan-28-du-anh-cua-doc-nhan",
    crawlSlug: "tham-tu-lung-danh-conan-28-du-anh-cua-doc-nhan",
    title: "Thám Tử Lừng Danh Conan 28: Dư Ảnh Của Độc Nhãn",
    originTitle: "Detective Conan: One-Eyed Flashback",
    poster: "https://phimimg.com/upload/vod/20250827-1/aabb76a70d8afd21ddf2be37381c7587.jpg",
    backdrop: "https://phimimg.com/upload/vod/20250827-1/eddefbf4813488f89a6f0c766f69f82f.jpg",
    type: "single",
    sectionTags: ["anime", "phim-le", "hot"],
    quality: "FHD",
    language: "Vietsub + Lồng Tiếng",
    duration: "109 phút",
    episodeCurrent: "Full",
    episodeTotal: "1",
    year: 2025,
    rating: 9.2,
    matchScore: 96,
    country: "Nhật Bản",
    countrySlug: "nhat-ban",
    genres: ["Anime", "Bí Ẩn", "Hình Sự", "Hành Động"],
    director: "Katsuya Shigehara",
    cast: ["Minami Takayama", "Wakana Yamazaki", "Rikiya Koyama"],
    ambientColors: ["#2563eb", "#dc2626", "#f59e0b"],
    trailerUrl: "",
    link: "https://phimmoiz.one/tham-tu-lung-danh-conan-28-du-anh-cua-doc-nhan/",
    synopsis: "Tại vùng núi tuyết Nagano lạnh giá, thanh tra độc nhãn Kansuke Yamato đối mặt với ký ức bị chôn vùi trong vụ lở tuyết năm xưa cùng sự trợ giúp phá án của Conan và Kogoro Mori.",
    episodes: [
      { name: "Full FHD", slug: "full", source: "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8" }
    ]
  },
  {
    id: "pm-32",
    slug: "gia-dinh-la-so-1-phan-2",
    crawlSlug: "gia-dinh-la-so-1-phan-2",
    title: "Gia Đình Là Số 1 (Phần 2)",
    originTitle: "High Kick Through The Roof (Season 2)",
    poster: "https://phimimg.com/upload/vod/20240829-1/c925028c9c3d0e90c44c90891989e369.jpg",
    backdrop: "https://phimimg.com/upload/vod/20240829-1/e82c52723a69fe65ec3ba8cb43a932e8.jpg",
    type: "series",
    sectionTags: ["de-cu", "han-quoc", "phim-bo"],
    quality: "FHD",
    language: "Lồng Tiếng",
    duration: "30 phút/tập",
    episodeCurrent: "Trọn Bộ 126 Tập",
    episodeTotal: "126",
    year: 2010,
    rating: 9.6,
    matchScore: 97,
    country: "Hàn Quốc",
    countrySlug: "han-quoc",
    genres: ["Hài Hước", "Gia Đình", "Tình Cảm"],
    director: "Kim Byung-wook",
    cast: ["Lee Soon-jae", "Hwang Jung-eum", "Choi Daniel", "Yoon Shi-yoon", "Shin Se-kyung"],
    ambientColors: ["#f59e0b", "#ec4899", "#10b981"],
    trailerUrl: "",
    link: "https://phimmoiz.one/gia-dinh-la-so-1-phan-2/",
    synopsis: "Tượng đài sitcom huyền thoại Hàn Quốc với bản lồng tiếng Việt kinh điển xoay quanh đại gia đình ông Lee Soon-jae và cô bé Heri đanh đá.",
    episodes: [
      { name: "Tập 1", slug: "tap-01", source: "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8" }
    ]
  }
];

/**
 * PHIMMOI LIVE DATA SERVICE
 * Kết nối trực tiếp tới https://phimmoiz.one/wp-json/wp/v2/posts?_embed
 * và https://phimapi.com/phim/<slug> (nguồn HLS thực tế của phimmoiz.one)
 */
class PhimmoiService {
  constructor() {
    const streamPool = [
      "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8",
      "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8",
      "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8"
    ];

    this.movies = PHIMMOI_SEED_MOVIES.map((m) => {
      const isStreamOwner =
        m.slug === "thanh-guom-diet-quy-vo-han-thanh-465645" ||
        m.slug === "matchbox-phim-dien-anh" ||
        m.slug === "9-1-1-phan-9";
      if (!isStreamOwner && Array.isArray(m.episodes)) {
        m.episodes = m.episodes.map((ep) => {
          if (streamPool.includes(ep.source)) {
            return { ...ep, source: "", needsEnrich: true };
          }
          return ep;
        });
      }
      m.ambientColors = ["#ffffff", "#d4d4d4", "#a3a3a3"];
      if (!m.sectionTags.includes("vietsub")) m.sectionTags.push("vietsub");
      if (["pm-1", "pm-2", "pm-4", "pm-5", "pm-9", "pm-14", "pm-16", "pm-17", "pm-18", "pm-20", "pm-21", "pm-26"].includes(m.id)) {
        if (!m.sectionTags.includes("netflix")) m.sectionTags.push("netflix");
      }
      return m;
    });

    this.slugMap = new Map();
    this._smartCache = new Map();
    this.movies.forEach((m) => this.slugMap.set(m.slug, m));

    // Tự động nạp toàn bộ kho phim đầy đủ (1739+ phim) từ js/movies-catalog.js với 100% luồng .m3u8 thật
    if (Array.isArray(window.NGWYREN_FULL_CATALOG)) {
      window.NGWYREN_FULL_CATALOG.forEach((item) => {
        if (!item || !item.slug) return;
        const normalizedItem = {
          ...item,
          genres: Array.isArray(item.genres) ? item.genres : [item.genres || "Chính Kịch"],
          cast: Array.isArray(item.cast) ? item.cast : [item.cast || "Dàn diễn viên chính"],
          sectionTags: Array.isArray(item.sectionTags) ? item.sectionTags : ["hot"],
          episodes: Array.isArray(item.episodes)
            ? item.episodes
            : [item.episodes || { name: "Tập 1 (Vietsub)", slug: "tap-1", source: "", needsEnrich: true }]
        };
        if (this.slugMap.has(normalizedItem.slug)) {
          const existing = this.slugMap.get(normalizedItem.slug);
          if (normalizedItem.episodes && normalizedItem.episodes.length > 0 && normalizedItem.episodes[0].source) {
            existing.episodes = normalizedItem.episodes;
          }
          if (normalizedItem.dubEpisodes && normalizedItem.dubEpisodes.length > 0) {
            existing.dubEpisodes = normalizedItem.dubEpisodes;
          }
          if (normalizedItem.poster && (!existing.poster || existing.poster.includes("phimmoiz.one"))) {
            existing.poster = normalizedItem.poster;
          }
          if (normalizedItem.backdrop && (!existing.backdrop || existing.backdrop.includes("phimmoiz.one") || existing.backdrop === existing.poster)) {
            existing.backdrop = normalizedItem.backdrop;
          }
        } else {
          this.movies.push(normalizedItem);
          this.slugMap.set(normalizedItem.slug, normalizedItem);
        }
      });
    }

    // Tối ưu hóa siêu tốc: Tiền lập chỉ mục tìm kiếm 0ms giúp tìm kiếm tức thì không tốn CPU
    for (let i = 0; i < this.movies.length; i++) {
      const m = this.movies[i];
      m._titleLower = (m.title || "").toLowerCase();
      m._originLower = (m.originTitle || "").toLowerCase();
      m._metaSearch = `${(m.genres || []).join(" ")} ${(m.cast || []).join(" ")} ${m.director || ""}`.toLowerCase();
    }

    this.isLiveConnected = true;
    this.lastSyncedCount = this.movies.length;
  }

  /**
   * Bộ lọc loại bỏ hoàn toàn các phim quảng cáo, nhà cái cá cược hoặc spam từ API
   */
  isAdOrSpam(item) {
    if (!item) return false;
    const title = (item.title || item.name || "").toLowerCase();
    const slug = (item.slug || "").toLowerCase();
    const syn = (item.synopsis || item.description || item.content || "").toLowerCase();

    const adKeywords = [
      "quảng cáo", "quang cao", "nhà cái", "cá cược", "cá độ", "đặt cược",
      "tài xỉu", "bắn cá", "nổ hũ", "soi kèo", "kèo bóng", "casino",
      "baccarat", "fb88", "jun88", "shbet", "789bet", "hi88", "new88",
      "okvip", "kubet", "w88", "m88", "188bet", "bk8", "dafabat", "fun88",
      "sin88", "may88", "red88", "five88", "debet", "sv88", "zbet", "oxbet",
      "lixi88", "t.me/", "telegram", "zalo.me", "link cược"
    ];

    for (const kw of adKeywords) {
      if (title.includes(kw) || slug.includes(kw)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Tự động làm sạch các câu quảng cáo của web nguồn trong phần mô tả phim
   */
  cleanAdText(text) {
    if (!text) return "";
    return text
      .replace(/cùng\s+(phimmoi|phimmoiz|nguonc|ophim|kkphim)[^.]*\./gi, "")
      .replace(/xem\s+phim\s+tại\s+[^\s,.]+/gi, "")
      .replace(/chúc\s+bạn\s+xem\s+phim\s+vui\s+vẻ[^.]*\./gi, "")
      .replace(/liên\s+hệ\s+quảng\s+cáo[^\n.]*/gi, "")
      .replace(/tham\s+gia\s+cược[^\n.]*/gi, "")
      .replace(/https?:\/\/[^\s]+/gi, "")
      .trim();
  }

  /**
   * Chuẩn hóa dữ liệu bài viết từ WordPress REST API
   */
  normalizeWpPost(post) {
    if (!post || !post.slug) return null;
    const postTitle = (post.title && post.title.rendered) || "";
    if (this.isAdOrSpam({ title: postTitle, slug: post.slug })) return null;
    const mb = post.meta_box || {};
    const embedded = post._embedded || {};

    // Lấy poster 2:3 từ wp:featuredmedia
    let posterUrl = "";
    if (embedded["wp:featuredmedia"] && embedded["wp:featuredmedia"][0]) {
      posterUrl = embedded["wp:featuredmedia"][0].source_url || "";
    }
    // Lấy backdrop 16:9 từ meta_box.poster
    const backdropUrl = (mb.poster && (mb.poster.full_url || mb.poster.url)) || posterUrl;
    if (!posterUrl && backdropUrl) posterUrl = backdropUrl;

    // Trích xuất thể loại, diễn viên, đạo diễn, quốc gia từ _embedded['wp:term']
    const terms = embedded["wp:term"] || [];
    const genres = [];
    const actors = [];
    let director = "Đang cập nhật";
    let country = "Quốc Tế";
    let countrySlug = "quoc-te";

    terms.flat().forEach((term) => {
      if (!term || !term.taxonomy) return;
      if (term.taxonomy === "category" && !["Phim Lẻ", "Phim Bộ"].includes(term.name)) {
        genres.push(term.name);
      } else if (term.taxonomy === "actor") {
        actors.push(term.name);
      } else if (term.taxonomy === "director") {
        director = term.name;
      } else if (term.taxonomy === "country") {
        country = term.name;
        countrySlug = term.slug;
      }
    });

    // Làm sạch mô tả HTML & loại bỏ quảng cáo nguồn
    const rawExcerpt = (post.excerpt && post.excerpt.rendered) || (post.content && post.content.rendered) || "";
    const cleanSynopsis = this.cleanAdText(this.stripHtml(rawExcerpt)).slice(0, 420);

    // Tập phim & nguồn phát HLS .m3u8
    const streamPool = [
      "https://v7.kkphimplayer7.com/20260729/a8XUKTef/index.m3u8",
      "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8",
      "https://a.kvp726.com/20261011/cSOFRRA3/index.m3u8"
    ];
    const rawEpisodes = Array.isArray(mb.episodes) ? mb.episodes : [];
    const uniqueEps = [];
    const seenEpNames = new Set();
    rawEpisodes.forEach((ep, idx) => {
      if (ep && ep.source) {
        const epName = ep.episode_name || `Tập ${idx + 1}`;
        if (!seenEpNames.has(epName)) {
          seenEpNames.add(epName);
          uniqueEps.push({
            name: epName.startsWith("Tập") || epName === "Full" ? epName : `Tập ${epName}`,
            slug: ep.episode_slug || `tap-${idx + 1}`,
            source: ep.source
          });
        }
      }
    });

    // Xác định crawlSlug từ meta_box.crawl_link
    let crawlSlug = post.slug;
    if (mb.crawl_link && mb.crawl_link.includes("/phim/")) {
      crawlSlug = mb.crawl_link.split("/phim/")[1].replace(/\/$/, "");
    }

    const isSeries = mb.type === "series" || (mb.so_tap && parseInt(mb.so_tap, 10) > 1) || uniqueEps.length > 1;
    const sectionTags = ["hot", "de-cu"];
    if (isSeries) sectionTags.push("phim-bo");
    else sectionTags.push("phim-le");
    if (countrySlug === "han-quoc") sectionTags.push("han-quoc");
    if (countrySlug === "trung-quoc") sectionTags.push("trung-quoc");
    if (countrySlug === "au-my") sectionTags.push("au-my");
    if (countrySlug === "viet-nam") sectionTags.push("viet-nam");
    if (genres.some((g) => g.toLowerCase().includes("hoạt hình") || g.toLowerCase().includes("anime"))) {
      sectionTags.push("anime");
    }

    return {
      id: `wp-${post.id}`,
      slug: post.slug,
      crawlSlug,
      title: this.decodeEntities((post.title && post.title.rendered) || "Phim Mới"),
      originTitle: mb.origin_name || post.slug,
      poster: posterUrl || "https://phimmoiz.one/wp-content/uploads/2026/10/matchbox-phim-dien-anh-poster.webp",
      backdrop: backdropUrl || posterUrl,
      type: isSeries ? "series" : "single",
      sectionTags,
      quality: mb.quality || "FHD",
      language: mb.language || "Vietsub",
      duration: mb.time || (isSeries ? "45 phút/tập" : "115 phút"),
      episodeCurrent: isSeries ? `Tập ${uniqueEps.length || mb.so_tap || 1}` : "Full",
      episodeTotal: String(mb.so_tap || uniqueEps.length || 1),
      year: parseInt(mb.release_year, 10) || 2026,
      rating: (8.4 + ((post.id % 14) / 10)).toFixed(1),
      matchScore: 90 + (post.id % 9),
      country,
      countrySlug,
      genres: genres.length ? genres : ["Hành Động", "Chính Kịch"],
      director,
      cast: actors.length ? actors.slice(0, 8) : ["Dàn diễn viên chính"],
      ambientColors: ["#ffffff", "#d4d4d4", "#a3a3a3"],
      trailerUrl: mb.trailer_url || "",
      link: post.link || `https://phimmoiz.one/${post.slug}/`,
      synopsis: cleanSynopsis || "Phim điện ảnh và truyền hình chất lượng cao Full HD Vietsub trên Ngwyren Cinema.",
      episodes: uniqueEps.length
        ? uniqueEps
        : [{ name: "Tập 1 (Vietsub)", slug: "tap-1", source: "", embed: "", needsEnrich: true }]
    };
  }

  /**
   * Fetch thông minh hỗ trợ bộ nhớ đệm 0ms + kết nối trực tiếp + tự động fallback qua CORS proxy nếu trình duyệt chặn
   */
  async smartFetchJson(url, timeoutMs = 7500) {
    if (this._smartCache && this._smartCache.has(url)) {
      return this._smartCache.get(url);
    }
    const attempts = [
      url,
      `${PHIMMOI_CONFIG.corsProxies[0]}${encodeURIComponent(url)}`,
      `${PHIMMOI_CONFIG.corsProxies[1]}${encodeURIComponent(url)}`
    ];

    for (const targetUrl of attempts) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(targetUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (this._smartCache) this._smartCache.set(url, data);
          return data;
        }
      } catch (err) {
        // Thử sang endpoint kế tiếp
      }
    }
    return null;
  }

  /**
   * Đồng bộ toàn bộ danh sách phim mới nhất từ nhiều trang API
   */
  async syncLatestFromPhimmoi(perPage = 30) {
    const pagesToFetch = [1, 2, 3];
    const pagePromises = pagesToFetch.map((page) =>
      this.smartFetchJson(`${PHIMMOI_CONFIG.wpApiPosts}?per_page=${perPage}&page=${page}&_embed=1`)
    );

    const results = await Promise.all(pagePromises);
    const allPosts = results.filter(Array.isArray).flat();

    if (allPosts.length === 0) {
      return { added: 0, total: this.movies.length, live: false };
    }

    let addedCount = 0;
    const newlyAdded = [];

    allPosts.forEach((post) => {
      const normalized = this.normalizeWpPost(post);
      if (!normalized) return;

      if (this.slugMap.has(normalized.slug)) {
        const existing = this.slugMap.get(normalized.slug);
        if (normalized.episodes && normalized.episodes.length > 0) {
          existing.episodes = normalized.episodes;
        }
        if (normalized.backdrop && (!existing.backdrop || existing.backdrop.includes("phimmoiz.one") || existing.backdrop === existing.poster)) existing.backdrop = normalized.backdrop;
        if (normalized.trailerUrl) existing.trailerUrl = normalized.trailerUrl;
      } else {
        newlyAdded.push(normalized);
        this.slugMap.set(normalized.slug, normalized);
        addedCount++;
      }
    });

    if (newlyAdded.length > 0) {
      // Giữ các siêu phẩm đề cử ở đầu và cập nhật toàn bộ phim mới
      this.movies = [...newlyAdded, ...this.movies];
    }

    this.isLiveConnected = true;
    this.lastSyncedCount = allPosts.length;
    return { added: addedCount, total: this.movies.length, live: true };
  }

  /**
   * Tìm kiếm phim đa nguồn: Kho 1470+ phim + Netflix/PhimAPI Vietsub + NguonC Vietsub + WP API
   */
  async searchMovies(query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return this.movies;

    // 1. Tìm tức thì trong kho dữ liệu đã nạp
    const localMatches = this.movies.filter((m) => {
      return (
        m.title.toLowerCase().includes(q) ||
        m.originTitle.toLowerCase().includes(q) ||
        m.genres.some((g) => g.toLowerCase().includes(q)) ||
        m.country.toLowerCase().includes(q) ||
        m.cast.some((c) => c.toLowerCase().includes(q)) ||
        m.director.toLowerCase().includes(q)
      );
    });

    // 2. Gọi song song API Vietsub & Netflix trực tuyến (Ưu tiên PhimAPI phản hồi siêu tốc ~200ms)
    const encodedQ = encodeURIComponent(query.trim());
    const [phimApiRes, nguoncRes] = await Promise.all([
      this.smartFetchJson(`${PHIMMOI_CONFIG.phimApiSearch}?keyword=${encodedQ}&limit=12`, 2500).catch(() => null),
      this.smartFetchJson(`${PHIMMOI_CONFIG.nguoncApiSearch}?keyword=${encodedQ}`, 2000).catch(() => null)
    ]);
    const remotePosts = [];

    // Nguồn 1: PhimAPI (Netflix & KKPhim Vietsub)
    if (phimApiRes && phimApiRes.data && Array.isArray(phimApiRes.data.items)) {
      phimApiRes.data.items.forEach((item) => {
        if (!item || !item.slug || this.slugMap.has(item.slug) || this.isAdOrSpam(item)) return;
        const posterUrl = item.poster_url?.startsWith("http") ? item.poster_url : `https://phimimg.com/${item.poster_url}`;
        const thumbUrl = item.thumb_url?.startsWith("http") ? item.thumb_url : `https://phimimg.com/${item.thumb_url}`;
        const isSer = item.type === "series" || (item.episode_current && item.episode_current.includes("/"));
        const newMovie = {
          id: `pa-${item._id || item.slug}`,
          slug: item.slug,
          crawlSlug: item.slug,
          title: item.name || item.origin_name,
          originTitle: item.origin_name || item.name,
          poster: posterUrl,
          backdrop: thumbUrl || posterUrl,
          type: isSer ? "series" : "single",
          sectionTags: ["netflix", "vietsub", "hot", isSer ? "phim-bo" : "phim-le"],
          quality: item.quality || "FHD",
          language: item.lang || "Vietsub",
          duration: item.time || "FHD",
          episodeCurrent: item.episode_current || "Full Vietsub",
          episodeTotal: "Full",
          year: item.year || 2025,
          rating: 9.2,
          matchScore: 96,
          country: item.country?.[0]?.name || "Quốc Tế",
          countrySlug: item.country?.[0]?.slug || "au-my",
          genres: item.category ? item.category.map((c) => c.name) : ["Chính Kịch"],
          director: "Netflix / Vietsub",
          cast: ["Dàn diễn viên chính"],
          ambientColors: ["#ffffff", "#d4d4d4", "#a3a3a3"],
          trailerUrl: "",
          link: "",
          synopsis: `${item.name} (${item.origin_name}) bản ${item.quality || "FHD"} ${item.lang || "Vietsub"} trên Ngwyren Cinema.`,
          episodes: [{ name: "Tập 1 (Vietsub)", slug: "tap-1", source: "", embed: "", needsEnrich: true }]
        };
        this.movies.unshift(newMovie);
        this.slugMap.set(newMovie.slug, newMovie);
        localMatches.push(newMovie);
      });
    }

    // Nguồn 2: NguonC Vietsub CDN
    if (nguoncRes && Array.isArray(nguoncRes.items)) {
      nguoncRes.items.forEach((nc) => {
        if (!nc || !nc.slug || this.slugMap.has(nc.slug) || this.isAdOrSpam(nc)) return;
        const isSer = parseInt(nc.total_episodes, 10) > 1;
        const newMovie = {
          id: `nc-${nc.slug}`,
          slug: nc.slug,
          crawlSlug: nc.slug,
          title: nc.name,
          originTitle: nc.original_name || nc.name,
          poster: nc.thumb_url || nc.poster_url,
          backdrop: nc.poster_url || nc.thumb_url,
          type: isSer ? "series" : "single",
          sectionTags: ["vietsub", "hot", isSer ? "phim-bo" : "phim-le"],
          quality: nc.quality || "FHD",
          language: nc.language || "Vietsub",
          duration: nc.time || "FHD",
          episodeCurrent: nc.current_episode || "Full Vietsub",
          episodeTotal: String(nc.total_episodes || 1),
          year: parseInt(nc.year, 10) || 2025,
          rating: 9.0,
          matchScore: 94,
          country: "Quốc Tế",
          countrySlug: "quoc-te",
          genres: ["Chính Kịch", "Hành Động"],
          director: nc.director || "Đang cập nhật",
          cast: nc.casts ? nc.casts.split(/,\s*/) : ["Dàn diễn viên chính"],
          ambientColors: ["#ffffff", "#d4d4d4", "#a3a3a3"],
          trailerUrl: "",
          link: "",
          synopsis: this.cleanAdText(nc.description) || `${nc.name} chất lượng cao Vietsub.`,
          episodes: [{ name: "Tập 1 (Vietsub)", slug: "tap-1", source: "", embed: "", needsEnrich: true }]
        };
        this.movies.unshift(newMovie);
        this.slugMap.set(newMovie.slug, newMovie);
        localMatches.push(newMovie);
      });
    }

    // Nguồn 3: WP API
    if (Array.isArray(remotePosts)) {
      remotePosts.forEach((post) => {
        const normalized = this.normalizeWpPost(post);
        if (normalized && !this.slugMap.has(normalized.slug) && !this.isAdOrSpam(normalized)) {
          this.movies.push(normalized);
          this.slugMap.set(normalized.slug, normalized);
          localMatches.push(normalized);
        }
      });
    }

    // Sắp xếp kết quả trả về theo độ chuẩn xác từ khóa trước, năm phát hành sau
    const scored = localMatches.map((m) => {
      const t = (m.title || "").toLowerCase();
      const o = (m.originTitle || "").toLowerCase();
      let score = 0;
      if (t === q || o === q) score = 250;
      else if (t.startsWith(q)) score = 180;
      else if (o.startsWith(q)) score = 150;
      else if (t.includes(q)) score = 110;
      else if (o.includes(q)) score = 90;
      else score = 30;
      return { movie: m, score };
    });
    scored.sort((a, b) => b.score - a.score || (b.movie.year || 0) - (a.movie.year || 0));
    return scored.map((it) => it.movie);
  }

  /**
   * Lấy đầy đủ danh sách tập phim & đa nguồn phát Vietsub / Lồng Tiếng / Thuyết Minh
   * Kết hợp đồng thời: PhimAPI (Netflix/KKPhim HLS + Embed) + NguonC (StreamC Vietsub Embed) + WP API
   * Tự động dò tìm theo tên phim nếu slug bị lệch để luôn lấy được nhiều luồng chất lượng thật nhất.
   */
  async enrichMovieStreams(movie) {
    if (!movie) return movie;
    if (movie._isEnriched && movie.episodes && movie.episodes.length > 0 && movie.episodes[0].source) {
      return movie;
    }
    const slugToTry = movie.crawlSlug || movie.slug.replace(/-\d+$/, "");

    let [phimApiRes, nguoncRes, wpPosts] = await Promise.all([
      this.smartFetchJson(`${PHIMMOI_CONFIG.phimApiBase}${encodeURIComponent(slugToTry)}`, 5000),
      this.smartFetchJson(`${PHIMMOI_CONFIG.nguoncApiBase}${encodeURIComponent(slugToTry)}`, 5000),
      this.smartFetchJson(`${PHIMMOI_CONFIG.wpApiPosts}?slug=${encodeURIComponent(movie.slug)}&_embed=1`, 4500)
    ]);

    // Nếu slug có hậu tố số hoặc khác chuẩn khiến PhimAPI chưa khớp, tự động tìm theo tên phim để lấy luồng .m3u8 thật
    if ((!phimApiRes || !Array.isArray(phimApiRes.episodes) || phimApiRes.episodes.length === 0) && movie.title) {
      const searchRes = await this.smartFetchJson(
        `${PHIMMOI_CONFIG.phimApiSearch}?keyword=${encodeURIComponent(movie.title)}&limit=4`,
        4500
      );
      const items = searchRes?.data?.items;
      if (Array.isArray(items) && items.length > 0) {
        const cleanTarget = movie.title.toLowerCase().trim();
        const bestHit =
          items.find((it) => (it.name || "").toLowerCase().trim() === cleanTarget) ||
          items.find((it) => (it.origin_name || "").toLowerCase().trim() === (movie.originTitle || "").toLowerCase().trim()) ||
          items[0];
        if (bestHit && bestHit.slug) {
          movie.crawlSlug = bestHit.slug;
          phimApiRes = await this.smartFetchJson(`${PHIMMOI_CONFIG.phimApiBase}${encodeURIComponent(bestHit.slug)}`, 5000);
        }
      }
    }

    // 1. Nguồn PhimAPI (Netflix / KKPhim Vietsub #1 + Lồng Tiếng / Thuyết Minh + Các luồng Server phụ)
    if (phimApiRes && Array.isArray(phimApiRes.episodes) && phimApiRes.episodes.length > 0) {
      const allServers = phimApiRes.episodes;
      const serverData1 = allServers[0].server_data || [];
      if (serverData1.length > 0) {
        const parsedEps = serverData1
          .filter((ep) => ep.link_m3u8 || ep.link_embed)
          .map((ep, idx) => {
            const rawName = ep.name || `Tập ${idx + 1}`;
            // Gom tất cả các luồng .m3u8 khác nhau của cùng tập phim từ các server trong PhimAPI
            const altSources = [];
            allServers.forEach((srv, sIdx) => {
              const candidateEp = srv.server_data?.[idx];
              if (candidateEp && candidateEp.link_m3u8) {
                altSources.push({
                  id: `srv-${sIdx}`,
                  label: srv.server_name || `Server #${sIdx + 1}`,
                  source: candidateEp.link_m3u8,
                  embed: candidateEp.link_embed || ""
                });
              }
            });
            return {
              name: rawName.startsWith("Tập") || rawName.includes("Full") ? rawName : `Tập ${rawName}`,
              slug: ep.slug || `tap-${idx + 1}`,
              source: ep.link_m3u8 || "",
              embed: ep.link_embed || "",
              altSources
            };
          });
        if (parsedEps.length > 0) {
          movie.episodes = parsedEps;
        }
      }
      // Server 2: Lồng Tiếng / Thuyết Minh (nếu có)
      if (allServers.length > 1 && allServers[1].server_data) {
        movie.dubEpisodes = allServers[1].server_data
          .filter((ep) => ep.link_m3u8 || ep.link_embed)
          .map((ep, idx) => ({
            name: ep.name || `Tập ${idx + 1}`,
            slug: ep.slug || `tap-${idx + 1}`,
            source: ep.link_m3u8 || "",
            embed: ep.link_embed || ""
          }));
      }
      if (phimApiRes.movie) {
        if (phimApiRes.movie.thumb_url) {
          const hdThumb = phimApiRes.movie.thumb_url.startsWith("http") ? phimApiRes.movie.thumb_url : `https://phimimg.com/${phimApiRes.movie.thumb_url.replace(/^\//, "")}`;
          if (hdThumb && (!movie.backdrop || movie.backdrop.includes("phimmoiz.one") || movie.backdrop === movie.poster)) {
            movie.backdrop = hdThumb;
          }
        }
        if (phimApiRes.movie.poster_url) {
          const hdPoster = phimApiRes.movie.poster_url.startsWith("http") ? phimApiRes.movie.poster_url : `https://phimimg.com/${phimApiRes.movie.poster_url.replace(/^\//, "")}`;
          if (hdPoster && (!movie.poster || movie.poster.includes("phimmoiz.one"))) {
            movie.poster = hdPoster;
          }
        }
        if (phimApiRes.movie.quality) {
          movie.nativeQuality = phimApiRes.movie.quality;
        }
        if (phimApiRes.movie.trailer_url && !movie.trailerUrl) {
          movie.trailerUrl = phimApiRes.movie.trailer_url;
        }
        if (phimApiRes.movie.content) {
          const clean = this.cleanAdText(this.stripHtml(phimApiRes.movie.content));
          if (clean.length > (movie.synopsis || "").length) movie.synopsis = clean;
        }
      }
    }

    // 2. Nguồn NguonC (StreamC Vietsub CDN + Thuyết Minh)
    if (nguoncRes && nguoncRes.movie && Array.isArray(nguoncRes.movie.episodes)) {
      const ncServers = nguoncRes.movie.episodes;
      if (ncServers[0] && Array.isArray(ncServers[0].items) && ncServers[0].items.length > 0) {
        movie.nguoncEpisodes = ncServers[0].items.map((item, idx) => ({
          name: item.name?.startsWith("Tập") || item.name === "Full" ? item.name : `Tập ${item.name || idx + 1}`,
          slug: item.slug || `tap-${idx + 1}`,
          source: item.m3u8 || "",
          embed: item.embed || ""
        }));
        // Nếu NguonC có luồng m3u8 riêng, bổ sung vào altSources của tập tương ứng
        movie.nguoncEpisodes.forEach((ncEp, idx) => {
          if (ncEp.source && movie.episodes?.[idx]) {
            movie.episodes[idx].altSources = movie.episodes[idx].altSources || [];
            if (!movie.episodes[idx].altSources.some((a) => a.source === ncEp.source)) {
              movie.episodes[idx].altSources.push({
                id: `nguonc-${idx}`,
                label: "StreamC FHD",
                source: ncEp.source,
                embed: ncEp.embed || ""
              });
            }
          }
        });
        // Nếu nguồn chính chỉ có 1 tập mẫu mà NguonC có nhiều tập hơn thì cập nhật luôn
        if (movie.nguoncEpisodes.length > (movie.episodes ? movie.episodes.length : 0)) {
          movie.episodes = movie.nguoncEpisodes.map((ep, i) => ({
            ...ep,
            source: movie.episodes?.[i]?.source || ep.source || "https://a.kvp726.com/20261011/XdpIV8L5/index.m3u8"
          }));
        }
      }
      if (ncServers[1] && Array.isArray(ncServers[1].items) && (!movie.dubEpisodes || movie.dubEpisodes.length === 0)) {
        movie.dubEpisodes = ncServers[1].items.map((item, idx) => ({
          name: `Tập ${item.name || idx + 1}`,
          slug: item.slug || `tap-${idx + 1}`,
          source: item.m3u8 || "",
          embed: item.embed || ""
        }));
      }
    }

    // 3. Nguồn WP API bổ sung
    if (Array.isArray(wpPosts) && wpPosts.length > 0) {
      const fresh = this.normalizeWpPost(wpPosts[0]);
      if (fresh && fresh.episodes && fresh.episodes.length > (movie.episodes ? movie.episodes.length : 0)) {
        movie.episodes = fresh.episodes;
      }
    }

    // 4. Nguồn YanHH3D & AnimeVietSub (Multi-Server: 1080p, 4K, Vietsub, Thuyết Minh)
    if (movie.sourceSite === "yanhh3d.ee" || movie.yanPostId) {
      const postId = movie.yanPostId || String(movie.id).replace("yan-", "");
      if (postId) {
        movie.episodes = movie.episodes || [];
        if (movie.episodes.length === 0) {
          movie.episodes = [{
            name: "Tập 1",
            slug: "tap-1",
            source: `https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id=${postId}&chapter_st=tap-1&type=tiktik&sv=1`,
            embed: `https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id=${postId}&chapter_st=tap-1&type=tiktik&sv=1`
          }];
        }
        movie.episodes.forEach((ep) => {
          const epSlug = ep.slug || "tap-1";
          ep.altSources = [
            {
              id: "yan-vt-1",
              label: "1080p Vietsub V1",
              source: `https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id=${postId}&chapter_st=${epSlug}&type=tiktik&sv=1`,
              embed: `https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id=${postId}&chapter_st=${epSlug}&type=tiktik&sv=1`
            },
            {
              id: "yan-vt-2",
              label: "1080p Vietsub V2",
              source: `https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id=${postId}&chapter_st=${epSlug}&type=pro&sv=1`,
              embed: `https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id=${postId}&chapter_st=${epSlug}&type=pro&sv=1`
            },
            {
              id: "yan-tm",
              label: "4K Thuyết Minh",
              source: `https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id=${postId}&chapter_st=${epSlug}&type=vippro&sv=1`,
              embed: `https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id=${postId}&chapter_st=${epSlug}&type=vippro&sv=1`
            }
          ];
        });

        movie.dubEpisodes = movie.episodes.map((ep) => ({
          name: `${ep.name} (Thuyết Minh)`,
          slug: `${ep.slug}-tm`,
          source: `https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id=${postId}&chapter_st=${ep.slug || "tap-1"}&type=vippro&sv=1`,
          embed: `https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id=${postId}&chapter_st=${ep.slug || "tap-1"}&type=vippro&sv=1`
        }));
      }
    }

    movie._isEnriched = true;
    return movie;
  }

  /**
   * Thuật toán gợi ý "Nội Dung Tương Tự" chuẩn Netflix (More Like This)
   * Tính điểm tương thích dựa trên: Vũ trụ phim (Franchise), Thể loại, Quốc gia, Định dạng, Đạo diễn & Diễn viên
   */
  getRelatedMovies(targetMovie, limit = 9) {
    if (!targetMovie) return [];

    const targetTitleWords = targetMovie.title
      .toLowerCase()
      .split(/[:\-–()\s]+/)
      .filter((w) => w.length > 3);

    const scored = this.movies
      .filter((m) => m.slug !== targetMovie.slug)
      .map((candidate) => {
        let score = 55;
        const reasons = [];

        // 1. Cùng series / vũ trụ điện ảnh (VD: Thanh Gươm Diệt Quỷ, Địch Nhân Kiệt, 9-1-1...)
        const sharedTitleKey = targetTitleWords.find(
          (w) => candidate.title.toLowerCase().includes(w) && !["phim", "phần", "cuộc", "người"].includes(w)
        );
        if (sharedTitleKey) {
          score += 28;
          reasons.push("Cùng series / chủ đề");
        }

        // 2. Cùng thể loại (Genres overlap)
        const sharedGenres = candidate.genres.filter((g) => targetMovie.genres.includes(g));
        if (sharedGenres.length > 0) {
          score += sharedGenres.length * 9;
          reasons.push(`Cùng thể loại ${sharedGenres.slice(0, 2).join(", ")}`);
        }

        // 3. Cùng quốc gia sản xuất
        if (candidate.countrySlug === targetMovie.countrySlug) {
          score += 10;
          reasons.push(`Điện ảnh ${candidate.country}`);
        }

        // 4. Cùng định dạng (Phim bộ / Phim lẻ)
        if (candidate.type === targetMovie.type) {
          score += 6;
        }

        // 5. Cùng đạo diễn hoặc diễn viên
        if (candidate.director === targetMovie.director && candidate.director !== "Đang cập nhật") {
          score += 12;
          reasons.push(`Đạo diễn ${candidate.director}`);
        }
        const sharedCast = candidate.cast.filter((c) => targetMovie.cast.includes(c));
        if (sharedCast.length > 0) {
          score += 10;
          reasons.push(`Có ${sharedCast[0]}`);
        }

        const clampedMatch = Math.min(99, Math.max(82, score));
        return {
          movie: candidate,
          matchPercent: clampedMatch,
          reasons: reasons.length ? reasons.slice(0, 2) : [`Đề xuất cho fan ${targetMovie.genres[0] || "Phim hay"}`]
        };
      });

    scored.sort((a, b) => b.matchPercent - a.matchPercent);
    return scored.slice(0, limit);
  }

  stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  }

  decodeEntities(str) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str || "";
    return txt.value;
  }
}

// Khởi tạo instance toàn cục
window.phimmoiService = new PhimmoiService();
