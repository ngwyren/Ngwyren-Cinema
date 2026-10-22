/* ==========================================================================
   APPLE CINEMA VN — MAIN APPLICATION CONTROLLER (js/app.js)
   Giao diện Apple Music UI + Tính năng Netflix Related & HLS Player
   ========================================================================== */

class AppleCinemaApp {
  constructor() {
    this.service = window.phimmoiService;
    this.currentNav = "kham-pha";
    this.currentSegment = "all"; // all | series | single
    this.activeGenreFilter = "Tất cả";
    this.visibleGridLimit = 36;
    this.heroMovies = [];
    this.heroIndex = 0;
    this.heroTimer = null;

    // Trạng thái phim đang mở / đang phát
    this.selectedMovie = null;
    this.playingMovie = null;
    this.currentEpisodeIndex = 0;
    this.currentServerMode = "hls-1"; // hls-1 | embed-1 | nguonc-1 | dub-1 | trailer
    this.currentQuality = "native-max"; // native-max | level-N | alt-N | 4K-upscale | 2K-upscale | Auto
    this.detectedHlsLevels = [];
    this.actualVideoRes = { width: 0, height: 0, bitrateMbps: 0 };
    this.ActiveModalTab = "related"; // related | episodes | trailer | details
    this.isPlaying = false;
    this.lightsOff = false;
    this.hlsInstance = null;

    // Lưu trữ cá nhân (Danh sách của tôi & Lịch sử xem)
    this.myList = this.loadStorage("apple_cinema_mylist", ["pm-1", "pm-2", "pm-4"]);
    this.watchHistory = this.loadStorage("apple_cinema_history", [
      { slug: "thanh-guom-diet-quy-vo-han-thanh-465645", epIndex: 0, progress: 38, timestamp: Date.now() - 3600000 },
      { slug: "matchbox-phim-dien-anh", epIndex: 0, progress: 64, timestamp: Date.now() - 7200000 }
    ]);

    this.searchDebounce = null;
  }

  async init() {
    this.setupHeroMovies();
    this.bindGlobalEvents();
    this.updateSidebarCounts();

    // Khởi tạo thanh Now Playing mặc định với bộ phim đầu tiên trong lịch sử
    const initialPlaying = this.service.slugMap.get(this.watchHistory[0]?.slug) || this.service.movies[0];
    this.setNowPlayingBar(initialPlaying, 0, false);

    // Render giao diện tức thì (0ms)
    this.renderMainView();
    this.startHeroAutoRotate();

    // Đồng bộ ngầm dữ liệu mới nhất từ https://phimmoiz.one/wp-json/wp/v2/posts?_embed
    this.syncLivePhimmoi(false);
  }

  loadStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  saveStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  setupHeroMovies() {
    const preferredSlugs = [
      "thanh-guom-diet-quy-vo-han-thanh-465645",
      "matchbox-phim-dien-anh",
      "squid-game-3-765752",
      "tai-xe-an-danh-phan-3",
      "nhiem-vu-bat-kha-thi-nghiep-bao-phan-2-1",
      "mua-do"
    ];
    this.heroMovies = preferredSlugs
      .map((s) => this.service.slugMap.get(s))
      .filter(Boolean);
    if (this.heroMovies.length === 0) {
      this.heroMovies = this.service.movies.slice(0, 5);
    }
  }

  /* ==========================================================================
     AMBIENT COLOR & ARTWORK GLOW ENGINE (MINIMAL MONOCHROME MOTION)
     ========================================================================== */
  updateAmbientBackdrop(movie) {
    if (!movie) return;
    const artEl = document.getElementById("ambientArtworkBlur");
    if (artEl) {
      artEl.style.backgroundImage = `url('${movie.backdrop || movie.poster}')`;
    }
    document.documentElement.style.setProperty("--ambient-primary", "rgba(255, 255, 255, 0.08)");
    document.documentElement.style.setProperty("--ambient-secondary", "rgba(255, 255, 255, 0.05)");
    document.documentElement.style.setProperty("--ambient-tertiary", "rgba(255, 255, 255, 0.03)");
  }

  /* ==========================================================================
     LIVE SYNC ALL MOVIES
     ========================================================================== */
  async syncLivePhimmoi(showToast = true) {
    const statusText = document.getElementById("liveStatusText");
    const syncBtn = document.getElementById("btnSyncPhimmoi");
    if (statusText) statusText.textContent = "Đang cập nhật...";
    if (syncBtn) syncBtn.disabled = true;

    const result = await this.service.syncLatestFromPhimmoi(30);
    this.setupHeroMovies();
    this.updateSidebarCounts();

    if (statusText) {
      statusText.textContent = `Trực tuyến (${result.total} phim)`;
    }
    if (syncBtn) syncBtn.disabled = false;

    this.renderMainView();
    if (showToast) {
      if (result.added > 0) {
        this.showToast(`Đã cập nhật thêm ${result.added} phim mới (Tổng ${result.total} phim)`);
      } else {
        this.showToast(`Đã đồng bộ toàn bộ kho phim (${result.total} phim)`);
      }
    }
  }

  /* ==========================================================================
     NAVIGATION & VIEW RENDERING
     ========================================================================== */
  toggleMobileSidebar(forceState = null) {
    const sidebar = document.getElementById("appleSidebar");
    const backdrop = document.getElementById("sidebarMobileBackdrop");
    if (!sidebar) return;
    const isOpen = forceState !== null ? forceState : !sidebar.classList.contains("mobile-open");
    sidebar.classList.toggle("mobile-open", isOpen);
    if (backdrop) backdrop.classList.toggle("open", isOpen);
  }

  setNavigation(navKey, customTitle = null) {
    this.currentNav = navKey;
    this.customFilterTitle = customTitle;
    this.visibleGridLimit = 60;

    // Highlight sidebar & mobile liquid glass dock
    document.querySelectorAll(".nav-item[data-nav]").forEach((el) => {
      el.classList.toggle("active", el.dataset.nav === navKey);
    });
    document.querySelectorAll(".dock-tab-btn[data-nav]").forEach((el) => {
      el.classList.toggle("active", el.dataset.nav === navKey);
    });

    // Đóng sidebar mobile nếu đang mở
    this.toggleMobileSidebar(false);

    // Cuộn mượt lên đầu trang
    window.scrollTo({ top: 0, behavior: "smooth" });
    this.renderMainView();
  }

  renderMainView() {
    const container = document.getElementById("mainContentWrapper");
    if (!container) return;

    if (this.currentNav === "kham-pha" && this.activeGenreFilter === "Tất cả" && this.currentSegment === "all") {
      container.innerHTML = `
        ${this.renderHeroHTML()}
        ${this.renderGenreChipsHTML()}
        ${this.renderCarouselSection("Thế Giới Anime & Hoạt Hình Đỉnh Cao", "Tuyển tập hơn 320+ bộ Anime Nhật Bản 4K / FHD Vietsub & Thuyết Minh", this.getMoviesByTag("anime").slice(0, 24), "anime")}
        ${this.renderCarouselSection("Phim Độc Quyền Netflix (Vietsub & Lồng Tiếng)", "Tuyển tập Netflix Originals đình đám chất lượng Full HD", this.getMoviesByTag("netflix"), "netflix")}
        ${this.renderCarouselSection("Phim Đề Cử Hôm Nay", "Tuyển chọn những tác phẩm Vietsub nổi bật nhất", this.getMoviesByTag("de-cu"), "moi-cap-nhat")}
        ${this.renderTop10RankedSection()}
        ${this.renderAppleCharts3ColSection()}
        ${this.renderCarouselSection("Phim Hàn Quốc Thịnh Hành", "K-Drama kịch tính, lãng mạn & hành động đặc sắc", this.getMoviesByCountry("han-quoc"), "han-quoc")}
        ${this.renderCarouselSection("Hoa Ngữ & Cổ Trang Đặc Sắc", "Kỳ án, tu tiên huyền huyễn & ngôn tình chọn lọc", this.getMoviesByCountry("trung-quoc"), "trung-quoc")}
        ${this.renderCarouselSection("Điện Ảnh Việt Nam Chọn Lọc", "Phim chiếu rạp Việt Nam doanh thu trăm tỷ", this.getMoviesByCountry("viet-nam"), "viet-nam")}
        ${this.renderCarouselSection("Bom Tấn Âu Mỹ Đỉnh Cao", "Hành động gián điệp, viễn tưởng & kinh dị Hollywood", this.getMoviesByCountry("au-my"), "au-my")}
        <section class="movie-section">
          <div class="section-header">
            <div class="section-title-wrap">
              <h2 class="section-title">Toàn Bộ Kho Phim (${this.service.movies.length} phim)</h2>
              <p class="section-subtitle">Đang hiển thị ${Math.min(this.visibleGridLimit, this.service.movies.length)} / ${this.service.movies.length} bộ phim đã cập nhật</p>
            </div>
            <div class="section-controls">
              <button class="btn-see-all" onclick="app.setNavigation('moi-cap-nhat')">
                Xem danh sách đầy đủ <i class="fas fa-chevron-right" style="font-size: 0.72rem;"></i>
              </button>
            </div>
          </div>
          <div class="movie-grid">
            ${this.service.movies.slice(0, this.visibleGridLimit).map((m) => this.renderMovieCardHTML(m)).join("")}
          </div>
          ${this.renderLoadMoreButtonsHTML(this.service.movies.length)}
        </section>
      `;
      this.updateAmbientBackdrop(this.heroMovies[this.heroIndex] || this.service.movies[0]);
      return;
    }

    // Chế độ danh mục hoặc bộ lọc
    const { title, subtitle, list } = this.getFilteredCatalog();
    const visibleList = list.slice(0, this.visibleGridLimit);
    container.innerHTML = `
      ${this.renderGenreChipsHTML()}
      <section class="movie-section">
        <div class="section-header">
          <div class="section-title-wrap">
            <h1 class="section-title" style="font-size: 1.75rem;">${title}</h1>
            <p class="section-subtitle">${subtitle} • Hiển thị ${visibleList.length} / ${list.length} bộ phim</p>
          </div>
          <div class="section-controls">
            <button class="btn-glass-secondary" style="padding: 8px 16px; font-size: 0.82rem;" onclick="app.resetAllFilters()">
              <i class="fas fa-rotate-left"></i> Về Khám Phá
            </button>
          </div>
        </div>
        ${
          visibleList.length > 0
            ? `<div class="movie-grid">${visibleList.map((m) => this.renderMovieCardHTML(m)).join("")}</div>
               ${this.renderLoadMoreButtonsHTML(list.length)}`
            : `<div style="padding: 60px 20px; text-align: center; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
                <i class="fas fa-film" style="font-size: 2.5rem; color: #ffffff; margin-bottom: 12px;"></i>
                <h3 style="margin-bottom: 6px;">Chưa có phim trong mục này</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 16px;">Hãy thử chọn thể loại khác hoặc khám phá kho phim đề cử.</p>
                <button class="btn-primary-play" onclick="app.resetAllFilters()">Khám Phá Kho Phim</button>
              </div>`
        }
      </section>
    `;
    if (list[0]) this.updateAmbientBackdrop(list[0]);
  }

  renderLoadMoreButtonsHTML(totalCount) {
    if (this.visibleGridLimit >= totalCount) return "";
    const remaining = totalCount - this.visibleGridLimit;
    return `
      <div style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 24px;">
        <button class="btn-primary-play" onclick="app.loadMoreMovies(120)">
          <i class="fas fa-plus"></i> Xem Thêm Phim (+${Math.min(120, remaining)} phim)
        </button>
        <button class="btn-glass-secondary" onclick="app.loadMoreMovies(${totalCount})">
          Hiển Thị Tất Cả (${totalCount} phim)
        </button>
      </div>
    `;
  }

  loadMoreMovies(step = 120) {
    this.visibleGridLimit += step;
    this.renderMainView();
  }

  getFilteredCatalog() {
    let base = [...this.service.movies];
    let title = "Khám Phá Kho Phim";
    let subtitle = "Kho phim chất lượng cao Ngwyren Cinema";

    switch (this.currentNav) {
      case "netflix":
        base = this.getMoviesByTag("netflix");
        title = "Phim Độc Quyền Netflix";
        subtitle = "Kho phim Netflix Originals bản FHD Vietsub & Lồng Tiếng";
        break;
      case "vietsub":
        base = base.filter((m) => (m.language || "").toLowerCase().includes("vietsub") || (m.sectionTags && m.sectionTags.includes("vietsub")));
        title = "Kho Phim Vietsub Chất Lượng Cao";
        subtitle = "Tổng hợp đa nguồn phát Vietsub FHD mượt mà";
        break;
      case "moi-cap-nhat":
        title = "Tất Cả Phim Mới Cập Nhật";
        subtitle = "Toàn bộ danh sách phim mới nhất trên hệ thống";
        break;
      case "phim-bo":
        base = base.filter((m) => m.type === "series");
        title = "Phim Bộ Dài Tập";
        subtitle = "Trọn bộ Vietsub & Thuyết minh chất lượng cao";
        break;
      case "phim-le":
        base = base.filter((m) => m.type === "single");
        title = "Phim Lẻ Chiếu Rạp";
        subtitle = "Bom tấn điện ảnh Full HD";
        break;
      case "anime":
        base = this.getMoviesByTag("anime");
        title = "Anime & Hoạt Hình";
        subtitle = "Tuyển tập Anime Nhật Bản & Hoạt hình đặc sắc";
        break;
      case "viet-nam":
        base = this.getMoviesByCountry("viet-nam");
        title = "Điện Ảnh Việt Nam";
        subtitle = "Phim chiếu rạp & truyền hình Việt Nam";
        break;
      case "han-quoc":
        base = this.getMoviesByCountry("han-quoc");
        title = "Phim Hàn Quốc Tuyển Chọn";
        subtitle = "K-Drama ăn khách nhất hiện nay";
        break;
      case "trung-quoc":
        base = this.getMoviesByCountry("trung-quoc");
        title = "Phim Trung Quốc Đặc Sắc";
        subtitle = "Cổ trang, kiếm hiệp, trinh thám & ngôn tình";
        break;
      case "au-my":
        base = this.getMoviesByCountry("au-my");
        title = "Phim Âu Mỹ & Hollywood";
        subtitle = "Hành động, viễn tưởng & giật gân";
        break;
      case "yeu-thich":
        base = this.myList.map((idOrSlug) => this.findMovie(idOrSlug)).filter(Boolean);
        title = "Danh Sách Đã Lưu";
        subtitle = "Những bộ phim bạn đã lưu để thưởng thức";
        break;
      case "lich-su":
        base = this.watchHistory.map((h) => this.findMovie(h.slug)).filter(Boolean);
        title = "Lịch Sử Xem Tiếp";
        subtitle = "Tiếp tục thưởng thức từ tập phim đang xem dở";
        break;
      case "person-filter":
        base = base.filter(
          (m) =>
            m.cast.includes(this.customFilterValue) ||
            m.director === this.customFilterValue
        );
        title = `Phim của ${this.customFilterValue}`;
        subtitle = "Tác phẩm liên quan đến diễn viên / đạo diễn này";
        break;
      case "search-results":
        base = this.lastSearchResults || [];
        title = `Kết quả tìm kiếm: "${this.lastSearchQuery || ""}"`;
        subtitle = "Tìm kiếm trên toàn bộ kho phim Ngwyren Cinema";
        break;
    }

    // Lọc theo Segmented Control (Tất cả / Phim Bộ / Phim Lẻ)
    if (this.currentSegment === "series") {
      base = base.filter((m) => m.type === "series");
    } else if (this.currentSegment === "single") {
      base = base.filter((m) => m.type === "single");
    }

    // Lọc theo thể loại hoặc độ phân giải (Genre / Quality chip)
    if (this.activeGenreFilter && this.activeGenreFilter !== "Tất cả") {
      if (this.activeGenreFilter === "4K / 2K") {
        base = base.filter(
          (m) =>
            (m.quality && (m.quality.includes("4K") || m.quality.includes("2K") || m.quality.includes("FHD"))) ||
            (m.sectionTags && m.sectionTags.includes("netflix"))
        );
        title = "Kho Phim Chất Lượng 4K / 2K Ultra HD";
      } else {
        base = base.filter((m) =>
          m.genres.some((g) => g.toLowerCase() === this.activeGenreFilter.toLowerCase())
        );
        title = `Thể loại: ${this.activeGenreFilter}`;
      }
    }

    return { title, subtitle, list: base };
  }

  resetAllFilters() {
    this.currentNav = "kham-pha";
    this.currentSegment = "all";
    this.activeGenreFilter = "Tất cả";
    document.querySelectorAll(".segment-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.segment === "all");
    });
    this.setNavigation("kham-pha");
  }

  /* ==========================================================================
     HTML BUILDERS FOR SECTIONS & CARDS
     ========================================================================== */
  renderHeroHTML() {
    const movie = this.heroMovies[this.heroIndex] || this.service.movies[0];
    if (!movie) return "";
    const inMyList = this.isInMyList(movie);

    return `
      <section class="hero-showcase" id="heroShowcase">
        <div class="hero-backdrop-layer">
          <img class="hero-backdrop-img" src="${movie.backdrop || movie.poster}" alt="${movie.title}" />
        </div>
        <div class="hero-gradient-overlay"></div>

        <div class="hero-content-grid">
          <div class="hero-info">
            <div class="hero-kicker">
              <i class="fas fa-film"></i> NGWYREN CINEMA ĐỀ CỬ #${this.heroIndex + 1}
            </div>
            <h1 class="hero-title">${movie.title}</h1>
            <div class="hero-origin-title">${movie.originTitle} (${movie.year})</div>

            <div class="hero-meta-pills">
              <span class="meta-pill match">${movie.matchScore}% Phù hợp</span>
              <span class="meta-pill quality">${movie.quality} • ${movie.language}</span>
              <span class="meta-pill">${movie.duration}</span>
              <span class="meta-pill">${movie.country}</span>
              ${movie.genres.slice(0, 3).map((g) => `<span class="meta-pill">${g}</span>`).join("")}
            </div>

            <p class="hero-desc">${movie.synopsis}</p>

            <div class="hero-actions">
              <button class="btn-primary-play" onclick="app.openMovieModal('${movie.slug}', true)">
                <i class="fas fa-play"></i> Xem Phim Ngay
              </button>
              <button class="btn-glass-secondary" onclick="app.openMovieModal('${movie.slug}', false)">
                <i class="fas fa-clone"></i> Chi Tiết & Nội Dung Liên Quan
              </button>
              <button class="btn-glass-secondary" onclick="app.toggleMyList('${movie.slug}', event)">
                <i class="fas ${inMyList ? "fa-check" : "fa-plus"}"></i>
                ${inMyList ? "Đã Lưu" : "Danh Sách"}
              </button>
            </div>
          </div>

          <div class="hero-right-panel">
            <div class="hero-floating-poster" onclick="app.openMovieModal('${movie.slug}', false)" title="Xem chi tiết ${movie.title}">
              <img src="${movie.poster}" alt="${movie.title}" />
            </div>
            <div class="hero-indicators">
              ${this.heroMovies
                .map(
                  (_, idx) => `
                <button class="hero-dot ${idx === this.heroIndex ? "active" : ""}" onclick="app.setHeroSlide(${idx})" aria-label="Slide ${idx + 1}"></button>
              `
                )
                .join("")}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  renderGenreChipsHTML() {
    const genres = [
      { label: "Tất cả", icon: "fa-sparkles" },
      { label: "4K / 2K", icon: "fa-tv" },
      { label: "Hành Động", icon: "fa-fire" },
      { label: "Bí Ẩn", icon: "fa-user-secret" },
      { label: "Cổ Trang", icon: "fa-scroll" },
      { label: "Tình Cảm", icon: "fa-heart" },
      { label: "Anime", icon: "fa-wand-magic-sparkles" },
      { label: "Hài Hước", icon: "fa-face-laugh-beam" },
      { label: "Viễn Tưởng", icon: "fa-rocket" },
      { label: "Hình Sự", icon: "fa-shield-halved" },
      { label: "Chính Kịch", icon: "fa-masks-theater" },
      { label: "Gia Đình", icon: "fa-house-chimney-heart" }
    ];

    return `
      <div class="quick-filters-bar">
        ${genres
          .map(
            (g) => `
          <button class="filter-chip ${this.activeGenreFilter === g.label ? "active" : ""}" onclick="app.selectGenreChip('${g.label}')">
            <i class="fas ${g.icon}"></i>
            <span>${g.label}</span>
          </button>
        `
          )
          .join("")}
      </div>
    `;
  }

  renderCarouselSection(title, subtitle, movies, navTarget) {
    const trackId = `track-${Math.random().toString(36).slice(2, 8)}`;
    return `
      <section class="movie-section">
        <div class="section-header">
          <div class="section-title-wrap">
            <h2 class="section-title">${title}</h2>
            <p class="section-subtitle">${subtitle}</p>
          </div>
          <div class="section-controls">
            ${
              navTarget
                ? `<button class="btn-see-all" onclick="app.setNavigation('${navTarget}')">
                    Xem tất cả <i class="fas fa-chevron-right" style="font-size: 0.72rem;"></i>
                  </button>`
                : ""
            }
            <button class="carousel-nav-btn" onclick="app.scrollTrack('${trackId}', -1)" aria-label="Trước">
              <i class="fas fa-chevron-left"></i>
            </button>
            <button class="carousel-nav-btn" onclick="app.scrollTrack('${trackId}', 1)" aria-label="Tiếp">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
        <div class="movie-track" id="${trackId}">
          ${movies.map((m) => this.renderMovieCardHTML(m)).join("")}
        </div>
      </section>
    `;
  }

  renderTop10RankedSection() {
    const topMovies = this.service.movies.slice(0, 10);
    const trackId = "track-top10";
    return `
      <section class="movie-section">
        <div class="section-header">
          <div class="section-title-wrap">
            <h2 class="section-title">Top 10 Phim Xu Hướng</h2>
            <p class="section-subtitle">Bảng xếp hạng những bộ phim được xem nhiều nhất hôm nay</p>
          </div>
          <div class="section-controls">
            <button class="carousel-nav-btn" onclick="app.scrollTrack('${trackId}', -1)">
              <i class="fas fa-chevron-left"></i>
            </button>
            <button class="carousel-nav-btn" onclick="app.scrollTrack('${trackId}', 1)">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
        <div class="movie-track" id="${trackId}">
          ${topMovies.map((m, idx) => this.renderMovieCardHTML(m, idx + 1)).join("")}
        </div>
      </section>
    `;
  }

  renderAppleCharts3ColSection() {
    const newSingles = this.service.movies.filter((m) => m.type === "single").slice(0, 5);
    const newSeries = this.service.movies.filter((m) => m.type === "series").slice(0, 5);
    const topRated = [...this.service.movies].sort((a, b) => b.rating - a.rating).slice(0, 5);

    const renderList = (items) =>
      items
        .map(
          (m, idx) => `
        <div class="chart-row-item" onclick="app.openMovieModal('${m.slug}', false)">
          <span class="chart-rank-num">${idx + 1}</span>
          <img class="chart-thumb" src="${m.poster}" alt="${m.title}" loading="lazy" />
          <div class="chart-info">
            <div class="chart-title">${m.title}</div>
            <div class="chart-sub">${m.originTitle} • ${m.country}</div>
          </div>
          <span class="chart-ep-tag">${m.type === "series" ? m.episodeCurrent : m.duration}</span>
        </div>
      `
        )
        .join("");

    return `
      <section class="movie-section">
        <div class="section-header">
          <div class="section-title-wrap">
            <h2 class="section-title">Bảng Xếp Hạng Ngwyren Cinema</h2>
            <p class="section-subtitle">Cập nhật liên tục Phim lẻ mới, Phim bộ mới & Đánh giá cao nhất</p>
          </div>
        </div>
        <div class="charts-grid-3">
          <div class="chart-column-card">
            <div class="chart-column-header">
              <div class="chart-column-title"><i class="fas fa-film"></i> Phim Lẻ Mới Nhất</div>
              <button class="btn-see-all" onclick="app.setNavigation('phim-le')">Tất cả</button>
            </div>
            <div class="chart-list">${renderList(newSingles)}</div>
          </div>

          <div class="chart-column-card">
            <div class="chart-column-header">
              <div class="chart-column-title"><i class="fas fa-tv"></i> Phim Bộ Mới Cập Nhật</div>
              <button class="btn-see-all" onclick="app.setNavigation('phim-bo')">Tất cả</button>
            </div>
            <div class="chart-list">${renderList(newSeries)}</div>
          </div>

          <div class="chart-column-card">
            <div class="chart-column-header">
              <div class="chart-column-title"><i class="fas fa-star"></i> Điểm Đánh Giá Cao Nhất</div>
              <button class="btn-see-all" onclick="app.setNavigation('moi-cap-nhat')">Tất cả</button>
            </div>
            <div class="chart-list">${renderList(topRated)}</div>
          </div>
        </div>
      </section>
    `;
  }

  renderMovieCardHTML(movie, rankNum = null) {
    const inMyList = this.isInMyList(movie);
    return `
      <article class="movie-card ${rankNum ? "ranked-card" : ""}"
               onclick="app.openMovieModal('${movie.slug}', false)">
        <div class="movie-poster-wrap">
          <img src="${movie.poster}" alt="${movie.title}" loading="lazy"
               onerror="this.src='https://phimmoiz.one/wp-content/uploads/2026/10/matchbox-phim-dien-anh-poster.webp'" />
          <div class="poster-badges-top">
            <span class="ribbon-quality">${movie.quality}</span>
            <span class="ribbon-ep">${movie.type === "series" ? movie.episodeCurrent : movie.language.split("+")[0].trim()}</span>
          </div>
          ${rankNum ? `<span class="rank-number-badge">${rankNum}</span>` : ""}

          <div class="poster-hover-overlay">
            <div class="hover-play-center" onclick="event.stopPropagation(); app.openMovieModal('${movie.slug}', true)" title="Phát ngay">
              <i class="fas fa-play" style="margin-left: 2px;"></i>
            </div>
            <div class="hover-bottom-row">
              <span class="hover-match-score">${movie.matchScore}% Phù hợp</span>
              <div class="hover-action-btns">
                <button class="mini-circle-btn ${inMyList ? "active" : ""}"
                        onclick="app.toggleMyList('${movie.slug}', event)"
                        title="${inMyList ? "Xóa khỏi Danh sách" : "Thêm vào Danh sách"}">
                  <i class="fas ${inMyList ? "fa-check" : "fa-plus"}"></i>
                </button>
                <button class="mini-circle-btn"
                        onclick="event.stopPropagation(); app.openMovieModal('${movie.slug}', false)"
                        title="Nội dung tương tự & Chi tiết">
                  <i class="fas fa-chevron-down"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="movie-card-info">
          <h3 class="movie-card-title" title="${movie.title}">${movie.title}</h3>
          <div class="movie-card-sub">${movie.originTitle} • ${movie.year}</div>
        </div>
      </article>
    `;
  }

  /* ==========================================================================
     NETFLIX-STYLE MOVIE DETAIL MODAL & HLS STREAMING PLAYER
     ========================================================================== */
  async openMovieModal(slug, autoPlay = false, epIndex = 0) {
    const movie = this.findMovie(slug);
    if (!movie) return;

    this.selectedMovie = movie;
    this.currentEpisodeIndex = epIndex;
    this.ActiveModalTab = "related"; // Luôn ưu tiên hiển thị Nội dung tương tự kiểu Netflix + Tập phim
    this.updateAmbientBackdrop(movie);

    const modalBackdrop = document.getElementById("movieDetailModal");
    if (!modalBackdrop) return;

    this.renderModalContent(movie, autoPlay);
    modalBackdrop.classList.add("open");
    document.body.style.overflow = "hidden";

    const prevEpSource = movie.episodes?.[epIndex]?.source || "";

    if (autoPlay) {
      this.startVideoPlayback(movie, epIndex, "hls-1");
    }

    // Tự động lấy thêm danh sách tập phim & luồng chất lượng thật từ PhimAPI / NguonC / WP API
    const enriched = await this.service.enrichMovieStreams(movie);
    if (this.selectedMovie && this.selectedMovie.slug === enriched.slug) {
      this.refreshEpisodesInModal(enriched);
      const newEpSource = enriched.episodes?.[this.currentEpisodeIndex]?.source || "";
      const isPlayingNow = document.getElementById("activeVideoContainer")?.classList.contains("playing");
      if (isPlayingNow && newEpSource && newEpSource !== prevEpSource && this.currentServerMode === "hls-1") {
        this.startVideoPlayback(enriched, this.currentEpisodeIndex, "hls-1");
      } else {
        this.renderDynamicQualityButtons();
      }
    }
  }

  closeMovieModal() {
    const modalBackdrop = document.getElementById("movieDetailModal");
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove("open");
    modalBackdrop.classList.remove("lights-off");
    this.lightsOff = false;
    document.body.style.overflow = "";
    this.stopModalVideo();
  }

  minimizeToMiniPlayer() {
    if (this.selectedMovie) {
      this.setNowPlayingBar(this.selectedMovie, this.currentEpisodeIndex, true);
      this.showToast(`Đang thu nhỏ "${this.selectedMovie.title}" xuống thanh phát Ngwyren Cinema`);
    }
    this.closeMovieModal();
  }

  renderModalContent(movie, isPlayingNow = false) {
    const sheet = document.getElementById("movieDetailSheet");
    if (!sheet) return;

    const inMyList = this.isInMyList(movie);
    const relatedItems = this.service.getRelatedMovies(movie, 9);
    const currentEp = movie.episodes[this.currentEpisodeIndex] || movie.episodes[0];

    sheet.innerHTML = `
      <!-- Top Floating Modal Controls -->
      <div class="modal-top-controls">
        <button class="modal-ctrl-btn" onclick="app.toggleLightsOff()">
          <i class="fas fa-lightbulb"></i>
          <span id="lightsOffLabel">${this.lightsOff ? "Bật Đèn" : "Tắt Đèn Rạp"}</span>
        </button>
        <button class="modal-ctrl-btn" onclick="app.minimizeToMiniPlayer()" title="Thu nhỏ xuống thanh Now Playing">
          <i class="fas fa-compress-alt"></i> Thu Nhỏ
        </button>
        <button class="modal-ctrl-btn icon-only" onclick="app.closeMovieModal()" aria-label="Đóng">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- 16:9 Cinema Stage (Cover Preview + Active HLS/YouTube Player) -->
      <div class="modal-player-stage">
        <div class="player-cover-preview" id="modalCoverPreview"
             style="background-image: url('${movie.backdrop || movie.poster}'); ${isPlayingNow ? "display:none;" : ""}">
          <div class="player-cover-content">
            <div class="hero-kicker" style="margin-bottom: 10px;">
              <i class="fas fa-circle-play"></i> NGWYREN CINEMA STREAMING • ${movie.quality} ${movie.language}
            </div>
            <h2 style="font-size: clamp(1.6rem, 2.8vw, 2.5rem); font-weight: 800; line-height: 1.12; margin-bottom: 6px;">
              ${movie.title}
            </h2>
            <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 18px;">
              ${movie.originTitle} (${movie.year}) • ${movie.duration}
            </p>
            <div class="hero-actions">
              <button class="btn-primary-play" onclick="app.startVideoPlayback(app.selectedMovie, ${this.currentEpisodeIndex}, 'hls-1')">
                <i class="fas fa-play"></i> Phát ${currentEp ? currentEp.name : "Ngay"}
              </button>
              ${
                movie.trailerUrl
                  ? `<button class="btn-glass-secondary" onclick="app.startVideoPlayback(app.selectedMovie, ${this.currentEpisodeIndex}, 'trailer')">
                      <i class="fab fa-youtube"></i> Xem Trailer
                    </button>`
                  : ""
              }
              <button class="btn-glass-secondary" id="modalMyListBtn" onclick="app.toggleMyList('${movie.slug}', event)">
                <i class="fas ${inMyList ? "fa-check" : "fa-plus"}"></i>
                <span>${inMyList ? "Đã Lưu Danh Sách" : "Thêm Danh Sách"}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Active Video Container -->
        <div class="active-video-container ${isPlayingNow ? "playing" : ""}" id="activeVideoContainer">
          <div class="player-quality-floating-badge" id="playerFloatingQualityBadge">
            <i class="fas fa-sliders"></i>
            <span id="playerFloatingQualityText">${this.getQualityLabel(this.currentQuality)}</span>
          </div>
          <video id="hlsVideoElement" class="${this.getQualityVideoClass(this.currentQuality)}" controls playsinline poster="${movie.backdrop || movie.poster}"></video>
          <iframe id="trailerIframeElement" style="display: none;" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
        </div>
      </div>

      <!-- Server & Stream Switcher Toolbar (Multi-Source Netflix, Vietsub & 4K/2K Quality Switcher) -->
      <div class="player-toolbar">
        <div class="player-toolbar-left">
          <span class="server-label"><i class="fas fa-server"></i> Nguồn phát Vietsub:</span>
          <button class="server-btn ${this.currentServerMode === "hls-1" ? "active" : ""}" id="srvBtnHls1"
                  onclick="app.startVideoPlayback(app.selectedMovie, app.currentEpisodeIndex, 'hls-1')">
            <i class="fas fa-circle-play"></i> Netflix Vietsub #1 (HLS)
          </button>
          <button class="server-btn ${this.currentServerMode === "embed-1" ? "active" : ""}" id="srvBtnEmbed1"
                  onclick="app.startVideoPlayback(app.selectedMovie, app.currentEpisodeIndex, 'embed-1')">
            <i class="fas fa-closed-captioning"></i> Vietsub #2 (Embed FHD)
          </button>
          <button class="server-btn ${this.currentServerMode === "nguonc-1" ? "active" : ""}" id="srvBtnNguonc1"
                  onclick="app.startVideoPlayback(app.selectedMovie, app.currentEpisodeIndex, 'nguonc-1')">
            <i class="fas fa-cloud"></i> Vietsub #3 (StreamC)
          </button>
          <button class="server-btn ${this.currentServerMode === "dub-1" ? "active" : ""}" id="srvBtnDub1"
                  onclick="app.startVideoPlayback(app.selectedMovie, app.currentEpisodeIndex, 'dub-1')">
            <i class="fas fa-microphone-lines"></i> Lồng Tiếng / Thuyết Minh
          </button>
          ${
            movie.trailerUrl
              ? `<button class="server-btn ${this.currentServerMode === "trailer" ? "active" : ""}" id="srvBtnTrailer"
                        onclick="app.startVideoPlayback(app.selectedMovie, app.currentEpisodeIndex, 'trailer')">
                  <i class="fab fa-youtube"></i> Trailer
                </button>`
              : ""
          }
        </div>

        <div class="player-toolbar-right">
          <span class="server-label"><i class="fas fa-sliders"></i> Chất lượng luồng:</span>
          <div class="quality-selector-group" id="qualitySelectorGroup" role="group" aria-label="Chọn độ phân giải thực tế">
            ${this.buildQualityButtonsHTML()}
          </div>
        </div>
      </div>

      <!-- Modal Metadata & Netflix-style Related / Episodes Content -->
      <div class="modal-body-content">
        <div class="modal-info-grid">
          <div>
            <div class="hero-meta-pills" style="margin-bottom: 10px;">
              <span class="meta-pill match">${movie.matchScore}% Phù hợp với bạn</span>
              <span class="meta-pill quality">${movie.quality}</span>
              <span class="meta-pill">${movie.language}</span>
              <span class="meta-pill">${movie.year}</span>
              <span class="meta-pill"><i class="fas fa-star"></i> ${movie.rating}</span>
            </div>
            <p class="modal-synopsis">${movie.synopsis}</p>
          </div>

          <div class="modal-cast-meta">
            <div class="meta-line">
              <strong>Đạo diễn:</strong>
              <span class="clickable-tag" onclick="app.filterByPerson('${movie.director.replace(/'/g, "\\'")}')">${movie.director}</span>
            </div>
            <div class="meta-line">
              <strong>Diễn viên:</strong>
              ${movie.cast
                .map(
                  (actor) =>
                    `<span class="clickable-tag" onclick="app.filterByPerson('${actor.replace(/'/g, "\\'")}')">${actor}</span>`
                )
                .join(", ")}
            </div>
            <div class="meta-line">
              <strong>Thể loại:</strong>
              ${movie.genres
                .map(
                  (g) =>
                    `<span class="clickable-tag" onclick="app.filterByGenreFromModal('${g}')">${g}</span>`
                )
                .join(", ")}
            </div>
            <div class="meta-line">
              <strong>Quốc gia:</strong>
              <span class="clickable-tag" onclick="app.closeMovieModal(); app.setNavigation('${movie.countrySlug}')">${movie.country}</span>
            </div>
          </div>
        </div>

        <!-- Episode Selector Section (Always visible for quick access) -->
        <div>
          <div class="episodes-header-bar">
            <h3 style="font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-list-ul"></i>
              Danh Sách Tập Phim (${movie.episodes.length} tập)
            </h3>
            <span style="font-size: 0.8rem; color: var(--text-tertiary);">
              Trạng thái: <strong style="color: #ffffff;">${movie.episodeCurrent}</strong>
            </span>
          </div>
          <div class="episodes-grid" id="modalEpisodesGrid">
            ${this.renderEpisodesPillsHTML(movie)}
          </div>
        </div>

        <!-- Netflix-Style Tabs: Nội Dung Tương Tự (More Like This) & Thông Tin -->
        <div>
          <div class="modal-tabs-nav">
            <button class="modal-tab-btn active" id="tabBtnRelated" onclick="app.switchModalTab('related')">
              <i class="fas fa-wand-magic-sparkles"></i>
              Nội Dung Tương Tự (Giống Phim Này)
            </button>
            <button class="modal-tab-btn" id="tabBtnFranchise" onclick="app.switchModalTab('franchise')">
              <i class="fas fa-layer-group"></i>
              Cùng Thể Loại ${movie.genres[0] || ""}
            </button>
          </div>

          <!-- Tab Panel 1: Netflix More Like This -->
          <div id="modalTabPanelRelated" style="padding-top: 20px;">
            <div class="related-movies-grid">
              ${relatedItems
                .map(
                  ({ movie: rel, matchPercent, reasons }) => `
                <div class="netflix-related-card" onclick="app.openMovieModal('${rel.slug}', false)">
                  <div class="netflix-related-thumb">
                    <img src="${rel.backdrop || rel.poster}" alt="${rel.title}" loading="lazy" />
                    <span class="netflix-related-duration">${rel.type === "series" ? rel.episodeCurrent : rel.duration}</span>
                    <div class="hover-play-center" style="width: 44px; height: 44px;"
                         onclick="event.stopPropagation(); app.openMovieModal('${rel.slug}', true)">
                      <i class="fas fa-play"></i>
                    </div>
                  </div>
                  <div class="netflix-related-body">
                    <div class="netflix-related-top">
                      <span class="hover-match-score" style="font-size: 0.8rem;">${matchPercent}% Phù hợp</span>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span class="badge-mini">${rel.quality}</span>
                        <span class="badge-mini" style="background: rgba(255,255,255,0.1); color: #fff;">${rel.year}</span>
                        <button class="mini-circle-btn ${this.isInMyList(rel) ? "active" : ""}"
                                onclick="app.toggleMyList('${rel.slug}', event)"
                                title="Thêm vào Danh sách">
                          <i class="fas ${this.isInMyList(rel) ? "fa-check" : "fa-plus"}"></i>
                        </button>
                      </div>
                    </div>
                    <div class="netflix-related-title">${rel.title}</div>
                    <div style="font-size: 0.75rem; color: var(--text-tertiary);">${rel.originTitle}</div>
                    <p class="netflix-related-desc">${rel.synopsis}</p>
                    <div class="netflix-related-tags">
                      ${reasons.map((r) => `<span class="reason-badge"><i class="fas fa-link" style="font-size:0.6rem; color: #ffffff;"></i> ${r}</span>`).join("")}
                    </div>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <!-- Tab Panel 2: Same Genre Grid -->
          <div id="modalTabPanelFranchise" style="padding-top: 20px; display: none;">
            <div class="movie-grid">
              ${this.service.movies
                .filter((m) => m.slug !== movie.slug && m.genres.some((g) => movie.genres.includes(g)))
                .slice(0, 8)
                .map((m) => this.renderMovieCardHTML(m))
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderEpisodesPillsHTML(movie) {
    return movie.episodes
      .map(
        (ep, idx) => `
      <button class="ep-pill-btn ${idx === this.currentEpisodeIndex ? "active" : ""}"
              onclick="app.startVideoPlayback(app.selectedMovie, ${idx}, app.currentServerMode || 'hls-1')">
        <span>${ep.name}</span>
        <i class="fas ${idx === this.currentEpisodeIndex ? "fa-volume-high" : "fa-play"}" style="font-size: 0.72rem;"></i>
      </button>
    `
      )
      .join("");
  }

  refreshEpisodesInModal(movie) {
    const grid = document.getElementById("modalEpisodesGrid");
    if (grid) {
      grid.innerHTML = this.renderEpisodesPillsHTML(movie);
    }
  }

  switchModalTab(tabName) {
    document.getElementById("tabBtnRelated")?.classList.toggle("active", tabName === "related");
    document.getElementById("tabBtnFranchise")?.classList.toggle("active", tabName === "franchise");
    const p1 = document.getElementById("modalTabPanelRelated");
    const p2 = document.getElementById("modalTabPanelFranchise");
    if (p1) p1.style.display = tabName === "related" ? "block" : "none";
    if (p2) p2.style.display = tabName === "franchise" ? "block" : "none";
  }

  /* ==========================================================================
     HLS (.M3U8) & YOUTUBE TRAILER STREAMING ENGINE
     ========================================================================== */
  async startVideoPlayback(movie, epIndex = 0, serverMode = "hls-1") {
    if (!movie) return;
    this.selectedMovie = movie;
    this.playingMovie = movie;
    this.currentEpisodeIndex = epIndex;
    this.currentServerMode = serverMode;

    // Nếu tập phim chưa có luồng thật (mới tìm kiếm trực tuyến), tự động nạp luồng thật của đúng bộ phim đó trước khi phát
    const initialEp = movie.episodes?.[epIndex] || movie.episodes?.[0];
    if (initialEp?.needsEnrich || (!initialEp?.source && !initialEp?.embed)) {
      await this.service.enrichMovieStreams(movie);
      this.refreshEpisodesInModal(movie);
    }

    // Lưu vào Lịch sử xem tiếp
    this.recordWatchHistory(movie.slug, epIndex);
    this.setNowPlayingBar(movie, epIndex, true);

    const coverPreview = document.getElementById("modalCoverPreview");
    const videoContainer = document.getElementById("activeVideoContainer");
    const videoEl = document.getElementById("hlsVideoElement");
    const iframeEl = document.getElementById("trailerIframeElement");

    if (coverPreview) coverPreview.style.display = "none";
    if (videoContainer) videoContainer.classList.add("playing");

    // Highlight server buttons & episode buttons
    document.getElementById("srvBtnHls1")?.classList.toggle("active", serverMode === "hls-1");
    document.getElementById("srvBtnEmbed1")?.classList.toggle("active", serverMode === "embed-1");
    document.getElementById("srvBtnNguonc1")?.classList.toggle("active", serverMode === "nguonc-1");
    document.getElementById("srvBtnDub1")?.classList.toggle("active", serverMode === "dub-1");
    document.getElementById("srvBtnTrailer")?.classList.toggle("active", serverMode === "trailer");
    this.refreshEpisodesInModal(movie);

    const episode = movie.episodes[epIndex] || movie.episodes[0];
    const dubEp = movie.dubEpisodes?.[epIndex] || movie.dubEpisodes?.[0] || episode;
    const ncEp = movie.nguoncEpisodes?.[epIndex] || movie.nguoncEpisodes?.[0] || episode;

    // Chế độ phát Trailer YouTube
    if (serverMode === "trailer" && movie.trailerUrl) {
      this.destroyHls();
      if (videoEl) {
        videoEl.pause();
        videoEl.style.display = "none";
      }
      if (iframeEl) {
        const ytId = this.extractYouTubeId(movie.trailerUrl);
        iframeEl.src = ytId
          ? `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`
          : movie.trailerUrl;
        iframeEl.style.display = "block";
      }
      return;
    }

    // Chế độ phát Nguồn Vietsub #2 (Embed FHD) hoặc Nguồn Vietsub #3 (StreamC)
    const embedUrlToUse =
      serverMode === "embed-1"
        ? episode?.embed || ncEp?.embed
        : serverMode === "nguonc-1"
        ? ncEp?.embed || episode?.embed
        : serverMode === "dub-1" && !dubEp?.source && dubEp?.embed
        ? dubEp.embed
        : !episode?.source && episode?.embed
        ? episode.embed
        : "";

    if (embedUrlToUse) {
      this.destroyHls();
      if (videoEl) {
        videoEl.pause();
        videoEl.style.display = "none";
      }
      if (iframeEl) {
        iframeEl.src = embedUrlToUse;
        iframeEl.style.display = "block";
      }
      return;
    }

    // Chế độ phát HLS (.m3u8) trực tiếp của đúng bộ phim đang chọn (Tuyệt đối không dùng stream của phim khác)
    if (iframeEl) {
      iframeEl.src = "";
      iframeEl.style.display = "none";
    }
    if (!videoEl) return;
    videoEl.style.display = "block";

    let streamUrl = (episode && episode.source) || "";
    if (serverMode === "dub-1") {
      streamUrl = (dubEp && dubEp.source) || (episode && episode.source) || "";
    } else if (serverMode === "nguonc-1" || serverMode === "embed-1") {
      streamUrl = (ncEp && ncEp.source) || (episode && episode.source) || "";
    }

    if (!streamUrl && (episode?.embed || ncEp?.embed)) {
      videoEl.style.display = "none";
      if (iframeEl) {
        iframeEl.src = episode?.embed || ncEp?.embed;
        iframeEl.style.display = "block";
      }
      return;
    }

    this.destroyHls();
    this.detectedHlsLevels = [];
    this.actualVideoRes = { width: 0, height: 0, bitrateMbps: 0 };

    if (window.Hls && window.Hls.isSupported()) {
      this.hlsInstance = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true,
        capLevelToPlayerSize: false,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        abrEwmaDefaultEstimate: 25000000
      });
      this.hlsInstance.loadSource(streamUrl);
      this.hlsInstance.attachMedia(videoEl);
      this.hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, (_, data) => {
        this.inspectHlsLevels(data?.levels || this.hlsInstance.levels || []);
        this.applyHlsQualityLevel();
        this.renderDynamicQualityButtons();
        this.applyVideoQualityVisuals();
        videoEl.play().catch(() => {});
      });
      this.hlsInstance.on(window.Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const lvl = this.hlsInstance?.levels?.[data.level];
        if (lvl) {
          this.actualVideoRes.width = lvl.width || videoEl.videoWidth || 1920;
          this.actualVideoRes.height = lvl.height || videoEl.videoHeight || 1080;
          if (lvl.bitrate) {
            this.actualVideoRes.bitrateMbps = +(lvl.bitrate / 1000000).toFixed(1);
          }
          this.applyVideoQualityVisuals();
        }
      });
      this.hlsInstance.on(window.Hls.Events.ERROR, (_, data) => {
        if (data.fatal && (episode?.embed || ncEp?.embed)) {
          this.destroyHls();
          videoEl.style.display = "none";
          if (iframeEl) {
            iframeEl.src = episode?.embed || ncEp?.embed;
            iframeEl.style.display = "block";
          }
        }
      });
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = streamUrl;
      videoEl.addEventListener("loadedmetadata", () => {
        this.actualVideoRes.width = videoEl.videoWidth || 1920;
        this.actualVideoRes.height = videoEl.videoHeight || 1080;
        this.renderDynamicQualityButtons();
        this.applyVideoQualityVisuals();
        videoEl.play().catch(() => {});
      });
    }

    videoEl.onloadedmetadata = () => {
      if (videoEl.videoWidth && videoEl.videoHeight) {
        this.actualVideoRes.width = videoEl.videoWidth;
        this.actualVideoRes.height = videoEl.videoHeight;
        this.renderDynamicQualityButtons();
        this.applyVideoQualityVisuals();
      }
    };

    this.renderDynamicQualityButtons();
    this.applyVideoQualityVisuals();

    // Đồng bộ thanh thời gian với Apple Music Now Playing Bar
    videoEl.ontimeupdate = () => {
      if (!videoEl.duration) return;
      const pct = Math.min(100, (videoEl.currentTime / videoEl.duration) * 100);
      const fill = document.getElementById("nowPlayingScrubberFill");
      const curTime = document.getElementById("nowPlayingCurrentTime");
      const totTime = document.getElementById("nowPlayingTotalTime");
      if (fill) fill.style.width = `${pct}%`;
      if (curTime) curTime.textContent = this.formatSeconds(videoEl.currentTime);
      if (totTime) totTime.textContent = this.formatSeconds(videoEl.duration);
    };
  }

  inspectHlsLevels(rawLevels) {
    if (!Array.isArray(rawLevels) || rawLevels.length === 0) {
      this.detectedHlsLevels = [];
      return;
    }
    this.detectedHlsLevels = rawLevels.map((lvl, index) => {
      const w = lvl.width || 1920;
      const h = lvl.height || 1080;
      const mbps = lvl.bitrate ? +(lvl.bitrate / 1000000).toFixed(1) : 3.5;
      const tier = this.resolveResolutionTier(w, h);
      return {
        index,
        width: w,
        height: h,
        bitrateMbps: mbps,
        tier,
        shortLabel: `${tier} Gốc${mbps ? ` (${mbps}M)` : ""}`,
        detailLabel: `${tier} Gốc • ${w}×${h}${mbps ? ` (${mbps} Mbps)` : ""}`
      };
    });

    const highest = this.detectedHlsLevels[this.detectedHlsLevels.length - 1];
    if (highest) {
      this.actualVideoRes = {
        width: highest.width,
        height: highest.height,
        bitrateMbps: highest.bitrateMbps
      };
    }
  }

  resolveResolutionTier(w, h) {
    const maxDim = Math.max(w || 0, h || 0);
    if (maxDim >= 3600 || h >= 2000) return "4K UHD";
    if (maxDim >= 2400 || h >= 1350) return "2K QHD";
    if (maxDim >= 1800 || h >= 1000) return "1080p";
    if (maxDim >= 1200 || h >= 680) return "720p";
    if (maxDim >= 800 || h >= 460) return "480p";
    if (maxDim > 0) return `${h}p`;
    return "1080p";
  }

  buildQualityButtonsHTML() {
    const buttons = [];
    const levels = this.detectedHlsLevels || [];
    const ep = this.selectedMovie?.episodes?.[this.currentEpisodeIndex] || this.selectedMovie?.episodes?.[0];
    const altSources = ep?.altSources || [];

    if (levels.length > 1) {
      // Phim có nhiều mức chất lượng thật trong luồng .m3u8 (Multi-variant HLS)
      for (let i = levels.length - 1; i >= 0; i--) {
        const l = levels[i];
        const key = `level-${l.index}`;
        buttons.push({
          key,
          label: l.shortLabel,
          title: `Chuyển sang luồng gốc ${l.detailLabel}`
        });
      }
      buttons.push({
        key: "Auto",
        label: "Auto (ABR)",
        title: "Tự động điều chỉnh chất lượng theo tốc độ mạng"
      });
    } else {
      // Luồng .m3u8 có 1 độ phân giải gốc (ví dụ 1920x1080 3.5 Mbps)
      const w = this.actualVideoRes.width || 1920;
      const h = this.actualVideoRes.height || 1080;
      const mbps = this.actualVideoRes.bitrateMbps || 3.5;
      const nativeTier = this.resolveResolutionTier(w, h);
      buttons.push({
        key: "native-max",
        label: `${nativeTier} Gốc (${w}×${h} • ${mbps}M)`,
        title: `Phát luồng .m3u8 nguyên bản từ CDN (${w}×${h}, ${mbps} Mbps)`
      });
    }

    // Nếu tập phim có nhiều luồng .m3u8 từ các Server khác nhau (VD: Hà Nội / Đà Nẵng / StreamC)
    if (altSources.length > 1) {
      altSources.forEach((alt, idx) => {
        buttons.push({
          key: `alt-${idx}`,
          label: `Luồng #${idx + 1} (${alt.label.replace(/^#/, "")})`,
          title: `Đổi sang luồng .m3u8 từ ${alt.label}`
        });
      });
    }

    // Tùy chọn nâng cấp độ nét quang học (Cinema Super-Resolution Upscale) tách bạch rõ ràng với luồng gốc
    buttons.push({
      key: "2K-upscale",
      label: "2K Upscale",
      title: "Khóa luồng gốc cao nhất + Bộ lọc làm nét 2K QHD"
    });
    buttons.push({
      key: "4K-upscale",
      label: "4K Upscale",
      title: "Khóa luồng gốc cao nhất + Bộ lọc tương phản 4K Cinema Clarity"
    });

    return buttons
      .map(
        (b) => `
      <button class="quality-pill-btn ${this.currentQuality === b.key ? "active" : ""}"
              data-quality="${b.key}"
              title="${b.title}"
              onclick="app.setVideoQuality('${b.key}', true)">
        ${b.label}
      </button>
    `
      )
      .join("");
  }

  renderDynamicQualityButtons() {
    const group = document.getElementById("qualitySelectorGroup");
    if (group) {
      group.innerHTML = this.buildQualityButtonsHTML();
    }
  }

  getQualityLabel(q) {
    const w = this.actualVideoRes.width || 1920;
    const h = this.actualVideoRes.height || 1080;
    const mbps = this.actualVideoRes.bitrateMbps || 3.5;
    const nativeTier = this.resolveResolutionTier(w, h);
    const nativeInfo = `${nativeTier} GỐC (${w}×${h} • ${mbps} Mbps)`;

    if (q === "4K-upscale" || q === "4K") {
      return `LUỒNG ${nativeInfo} → 4K UHD UPSCALE`;
    }
    if (q === "2K-upscale" || q === "2K") {
      return `LUỒNG ${nativeInfo} → 2K QHD UPSCALE`;
    }
    if (q && q.startsWith("level-")) {
      const idx = parseInt(q.replace("level-", ""), 10);
      const lvl = this.detectedHlsLevels.find((l) => l.index === idx);
      if (lvl) return `LUỒNG ${lvl.detailLabel.toUpperCase()}`;
    }
    if (q === "Auto") {
      return `AUTO ABR • ĐANG PHÁT ${nativeInfo}`;
    }
    return `LUỒNG ${nativeInfo}`;
  }

  getQualityVideoClass(q) {
    if (q === "4K-upscale" || q === "4K") return "quality-4k";
    if (q === "2K-upscale" || q === "2K") return "quality-2k";
    return "";
  }

  setVideoQuality(qualityMode, showNotification = true) {
    // Nếu người dùng bấm chuyển sang luồng .m3u8 của Server phụ (alt-0, alt-1...)
    if (qualityMode.startsWith("alt-")) {
      const altIdx = parseInt(qualityMode.replace("alt-", ""), 10);
      const ep = this.selectedMovie?.episodes?.[this.currentEpisodeIndex] || this.selectedMovie?.episodes?.[0];
      const altObj = ep?.altSources?.[altIdx];
      if (altObj && altObj.source && this.hlsInstance) {
        const videoEl = document.getElementById("hlsVideoElement");
        const resumeTime = videoEl ? videoEl.currentTime : 0;
        this.currentQuality = qualityMode;
        this.hlsInstance.loadSource(altObj.source);
        this.hlsInstance.once(window.Hls.Events.MANIFEST_PARSED, () => {
          if (videoEl && resumeTime > 1) videoEl.currentTime = resumeTime;
          videoEl?.play().catch(() => {});
        });
        this.renderDynamicQualityButtons();
        if (showNotification) {
          this.showToast(`Đã chuyển sang luồng .m3u8 từ ${altObj.label}`);
        }
        return;
      }
    }

    this.currentQuality = qualityMode;
    this.renderDynamicQualityButtons();
    this.applyHlsQualityLevel();
    this.applyVideoQualityVisuals();

    if (this.playingMovie) {
      this.setNowPlayingBar(this.playingMovie, this.currentEpisodeIndex, this.isPlaying);
    }

    if (showNotification) {
      this.showToast(`Chất lượng phát: ${this.getQualityLabel(qualityMode)}`);
    }
  }

  applyHlsQualityLevel() {
    if (!this.hlsInstance || !this.hlsInstance.levels || this.hlsInstance.levels.length === 0) return;
    const levels = this.hlsInstance.levels;
    const maxIdx = levels.length - 1;

    if (this.currentQuality === "Auto") {
      this.hlsInstance.currentLevel = -1;
      return;
    }

    if (this.currentQuality.startsWith("level-")) {
      const targetIdx = parseInt(this.currentQuality.replace("level-", ""), 10);
      if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx <= maxIdx) {
        this.hlsInstance.currentLevel = targetIdx;
        this.hlsInstance.loadLevel = targetIdx;
        return;
      }
    }

    // Mặc định (native-max, 4K-upscale, 2K-upscale): khóa ở mức bitrate / độ phân giải gốc cao nhất của file .m3u8
    this.hlsInstance.currentLevel = maxIdx;
    this.hlsInstance.nextLevel = maxIdx;
  }

  applyVideoQualityVisuals() {
    const videoEl = document.getElementById("hlsVideoElement");
    if (videoEl) {
      videoEl.classList.remove("quality-4k", "quality-2k", "quality-720p");
      const cls = this.getQualityVideoClass(this.currentQuality);
      if (cls) videoEl.classList.add(cls);
    }
    const badgeText = document.getElementById("playerFloatingQualityText");
    if (badgeText) {
      badgeText.textContent = this.getQualityLabel(this.currentQuality);
    }
  }

  stopModalVideo() {
    this.destroyHls();
    const videoEl = document.getElementById("hlsVideoElement");
    const iframeEl = document.getElementById("trailerIframeElement");
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute("src");
    }
    if (iframeEl) {
      iframeEl.src = "";
    }
  }

  destroyHls() {
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }
  }

  /* ==========================================================================
     APPLE MUSIC "NOW PLAYING" MINI BAR CONTROLLER
     ========================================================================== */
  setNowPlayingBar(movie, epIndex = 0, playing = true) {
    if (!movie) return;
    this.playingMovie = movie;
    this.currentEpisodeIndex = epIndex;
    this.isPlaying = playing;

    const ep = movie.episodes[epIndex] || movie.episodes[0];
    const artImg = document.getElementById("nowPlayingArt");
    const titleText = document.getElementById("nowPlayingTitleText");
    const subText = document.getElementById("nowPlayingSubText");
    const eqBars = document.getElementById("nowPlayingEq");
    const playIcon = document.getElementById("nowPlayingPlayIcon");

    if (artImg) artImg.src = movie.poster;
    if (titleText) titleText.textContent = movie.title;
    if (subText) {
      subText.textContent = `${ep ? ep.name : "Full"} • ${movie.originTitle} (${movie.quality})`;
    }
    if (eqBars) eqBars.classList.toggle("paused", !playing);
    if (playIcon) {
      playIcon.className = playing ? "fas fa-pause" : "fas fa-play";
    }
  }

  toggleNowPlayingPlayPause() {
    if (!this.playingMovie) return;
    const modalOpen = document.getElementById("movieDetailModal")?.classList.contains("open");
    const videoEl = document.getElementById("hlsVideoElement");

    if (modalOpen && videoEl && videoEl.style.display !== "none") {
      if (videoEl.paused) {
        videoEl.play().catch(() => {});
        this.isPlaying = true;
      } else {
        videoEl.pause();
        this.isPlaying = false;
      }
      this.setNowPlayingBar(this.playingMovie, this.currentEpisodeIndex, this.isPlaying);
    } else {
      // Nếu modal đang đóng, mở thẳng rạp phim phát tiếp
      this.openMovieModal(this.playingMovie.slug, true, this.currentEpisodeIndex);
    }
  }

  stepNowPlayingEpisode(direction) {
    if (!this.playingMovie) return;
    const eps = this.playingMovie.episodes || [];
    if (eps.length <= 1) {
      // Chuyển sang bộ phim liên quan tiếp theo
      const related = this.service.getRelatedMovies(this.playingMovie, 3);
      if (related[0]) {
        this.openMovieModal(related[0].movie.slug, true, 0);
      }
      return;
    }
    const nextIdx = (this.currentEpisodeIndex + direction + eps.length) % eps.length;
    this.openMovieModal(this.playingMovie.slug, true, nextIdx);
  }

  /* ==========================================================================
     SEARCH, FILTERS, FAVORITES & HISTORY
     ========================================================================== */
  handleSearchInput(rawValue) {
    const query = (rawValue || "").trim();
    const clearBtn = document.getElementById("searchClearBtn");
    const dropdown = document.getElementById("searchDropdown");

    if (clearBtn) clearBtn.classList.toggle("visible", query.length > 0);

    if (!query) {
      if (dropdown) dropdown.classList.remove("open");
      return;
    }

    // Hiển thị gợi ý tức thì từ kho local
    const quickMatches = this.service.movies
      .filter(
        (m) =>
          m.title.toLowerCase().includes(query.toLowerCase()) ||
          m.originTitle.toLowerCase().includes(query.toLowerCase()) ||
          m.genres.some((g) => g.toLowerCase().includes(query.toLowerCase())) ||
          m.cast.some((c) => c.toLowerCase().includes(query.toLowerCase()))
      )
      .slice(0, 6);

    this.renderSearchDropdown(query, quickMatches, false);

    // Debounce gọi API tìm kiếm trực tuyến của Phimmoiz.one
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(async () => {
      const fullMatches = await this.service.searchMovies(query);
      this.lastSearchQuery = query;
      this.lastSearchResults = fullMatches;
      this.renderSearchDropdown(query, fullMatches.slice(0, 8), true);
    }, 320);
  }

  renderSearchDropdown(query, results, isLiveDone) {
    const dropdown = document.getElementById("searchDropdown");
    if (!dropdown) return;

    dropdown.innerHTML = `
      <div class="search-dropdown-header">
        <span><i class="fas fa-magnifying-glass"></i> Kết quả cho "${query}"</span>
        <span>${isLiveDone ? "Đã tìm trên Ngwyren Cinema" : "Đang tìm trực tuyến..."}</span>
      </div>
      ${
        results.length > 0
          ? results
              .map(
                (m) => `
            <div class="search-suggestion-item" onclick="app.selectSearchResult('${m.slug}')">
              <img src="${m.poster}" alt="${m.title}" />
              <div class="search-suggestion-info">
                <div class="search-suggestion-title">${m.title}</div>
                <div class="search-suggestion-sub">${m.originTitle} • ${m.country} (${m.year})</div>
                <div class="search-suggestion-meta">
                  <span class="badge-mini">${m.quality}</span>
                  <span class="badge-mini">${m.matchScore}% Phù hợp</span>
                  <span style="font-size: 0.7rem; color: var(--text-tertiary);">${m.genres.slice(0, 2).join(" • ")}</span>
                </div>
              </div>
              <i class="fas fa-play-circle" style="font-size: 1.3rem; color: #ffffff;"></i>
            </div>
          `
              )
              .join("") +
            `<button class="btn-sync-now" style="width: 100%; margin-top: 8px; padding: 9px;" onclick="app.showFullSearchResults('${query.replace(/'/g, "\\'")}')">
              Xem toàn bộ kết quả cho "${query}" (${(this.lastSearchResults || results).length} phim)
            </button>`
          : `<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 0.86rem;">
              Không tìm thấy phim khớp với "${query}". Hãy thử từ khóa khác!
            </div>`
      }
    `;
    dropdown.classList.add("open");
  }

  selectSearchResult(slug) {
    document.getElementById("searchDropdown")?.classList.remove("open");
    this.openMovieModal(slug, false);
  }

  async showFullSearchResults(query) {
    document.getElementById("searchDropdown")?.classList.remove("open");
    this.lastSearchQuery = query;
    this.lastSearchResults = await this.service.searchMovies(query);
    this.currentNav = "search-results";
    this.renderMainView();
  }

  clearSearch() {
    const input = document.getElementById("topSearchInput");
    const sideInput = document.getElementById("sidebarSearchInput");
    if (input) input.value = "";
    if (sideInput) sideInput.value = "";
    document.getElementById("searchClearBtn")?.classList.remove("visible");
    document.getElementById("searchDropdown")?.classList.remove("open");
    if (this.currentNav === "search-results") {
      this.resetAllFilters();
    }
  }

  selectGenreChip(genreLabel) {
    this.activeGenreFilter = genreLabel;
    this.renderMainView();
  }

  filterByGenreFromModal(genreLabel) {
    this.closeMovieModal();
    this.activeGenreFilter = genreLabel;
    this.renderMainView();
  }

  filterByPerson(personName) {
    this.closeMovieModal();
    this.customFilterValue = personName;
    this.currentNav = "person-filter";
    this.renderMainView();
  }

  toggleMyList(slug, event) {
    if (event) event.stopPropagation();
    const movie = this.findMovie(slug);
    if (!movie) return;

    const idx = this.myList.findIndex((item) => item === movie.slug || item === movie.id);
    if (idx >= 0) {
      this.myList.splice(idx, 1);
      this.showToast(`Đã xóa "${movie.title}" khỏi Danh sách đã lưu`);
    } else {
      this.myList.unshift(movie.slug);
      this.showToast(`Đã thêm "${movie.title}" vào Danh sách đã lưu`);
    }

    this.saveStorage("apple_cinema_mylist", this.myList);
    this.updateSidebarCounts();
    this.renderMainView();

    // Cập nhật nút trong Modal nếu đang mở
    const modalBtn = document.getElementById("modalMyListBtn");
    if (modalBtn && this.selectedMovie && this.selectedMovie.slug === movie.slug) {
      const saved = this.isInMyList(movie);
      modalBtn.innerHTML = `<i class="fas ${saved ? "fa-check" : "fa-plus"}"></i><span>${saved ? "Đã Lưu Danh Sách" : "Thêm Danh Sách"}</span>`;
    }
  }

  isInMyList(movie) {
    if (!movie) return false;
    return this.myList.includes(movie.slug) || this.myList.includes(movie.id);
  }

  recordWatchHistory(slug, epIndex = 0) {
    this.watchHistory = this.watchHistory.filter((h) => h.slug !== slug);
    this.watchHistory.unshift({
      slug,
      epIndex,
      progress: 15,
      timestamp: Date.now()
    });
    this.watchHistory = this.watchHistory.slice(0, 24);
    this.saveStorage("apple_cinema_history", this.watchHistory);
    this.updateSidebarCounts();
  }

  updateSidebarCounts() {
    const favCount = document.getElementById("myListCountBadge");
    const hisCount = document.getElementById("historyCountBadge");
    const totCount = document.getElementById("totalMoviesCountBadge");
    const animeCount = document.getElementById("animeMoviesCountBadge");
    if (favCount) favCount.textContent = this.myList.length;
    if (hisCount) hisCount.textContent = this.watchHistory.length;
    if (totCount) totCount.textContent = this.service.movies.length;
    if (animeCount) animeCount.textContent = this.getMoviesByTag("anime").length;
  }

  /* ==========================================================================
     HERO CAROUSEL & HELPERS
     ========================================================================== */
  startHeroAutoRotate() {
    clearInterval(this.heroTimer);
    this.heroTimer = setInterval(() => {
      if (this.currentNav === "kham-pha" && !document.getElementById("movieDetailModal")?.classList.contains("open")) {
        this.setHeroSlide((this.heroIndex + 1) % this.heroMovies.length);
      }
    }, 7500);
  }

  setHeroSlide(index) {
    this.heroIndex = index;
    const heroEl = document.getElementById("heroShowcase");
    if (heroEl) {
      heroEl.outerHTML = this.renderHeroHTML();
      this.updateAmbientBackdrop(this.heroMovies[this.heroIndex]);
    }
  }

  scrollTrack(trackId, direction) {
    const track = document.getElementById(trackId);
    if (!track) return;
    const scrollAmount = track.clientWidth * 0.82 * direction;
    track.scrollBy({ left: scrollAmount, behavior: "smooth" });
  }

  toggleLightsOff() {
    this.lightsOff = !this.lightsOff;
    document.getElementById("movieDetailModal")?.classList.toggle("lights-off", this.lightsOff);
    const label = document.getElementById("lightsOffLabel");
    if (label) label.textContent = this.lightsOff ? "Bật Đèn" : "Tắt Đèn Rạp";
  }

  findMovie(idOrSlug) {
    return (
      this.service.slugMap.get(idOrSlug) ||
      this.service.movies.find((m) => m.id === idOrSlug || m.slug === idOrSlug)
    );
  }

  getMoviesByTag(tag) {
    return this.service.movies.filter((m) => m.sectionTags && m.sectionTags.includes(tag));
  }

  getMoviesByCountry(countrySlug) {
    return this.service.movies.filter((m) => m.countrySlug === countrySlug);
  }

  extractYouTubeId(url) {
    if (!url) return "";
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : "";
  }

  formatSeconds(sec) {
    if (!sec || isNaN(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  showToast(message) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "apple-toast";
    toast.innerHTML = `<i class="fas fa-circle-check" style="color: #ffffff;"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  bindGlobalEvents() {
    // Segmented control trên Topbar
    document.querySelectorAll(".segment-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".segment-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentSegment = btn.dataset.segment || "all";
        this.renderMainView();
      });
    });

    // Tìm kiếm Topbar & Sidebar
    const topInput = document.getElementById("topSearchInput");
    const sideInput = document.getElementById("sidebarSearchInput");

    if (topInput) {
      topInput.addEventListener("input", (e) => this.handleSearchInput(e.target.value));
      topInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && topInput.value.trim()) {
          this.showFullSearchResults(topInput.value.trim());
        }
      });
    }

    if (sideInput) {
      sideInput.addEventListener("input", (e) => {
        if (topInput) topInput.value = e.target.value;
        this.handleSearchInput(e.target.value);
      });
      sideInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && sideInput.value.trim()) {
          this.showFullSearchResults(sideInput.value.trim());
        }
      });
    }

    // Đóng dropdown tìm kiếm khi click ra ngoài
    document.addEventListener("click", (e) => {
      const searchBox = document.querySelector(".topbar-search-container");
      if (searchBox && !searchBox.contains(e.target)) {
        document.getElementById("searchDropdown")?.classList.remove("open");
      }
    });

    // Phím tắt Ctrl+K hoặc / để tìm kiếm nhanh, ESC để đóng Modal
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        topInput?.focus();
      } else if (e.key === "Escape") {
        document.getElementById("searchDropdown")?.classList.remove("open");
        this.toggleMobileSidebar(false);
        if (document.getElementById("movieDetailModal")?.classList.contains("open")) {
          this.closeMovieModal();
        }
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new AppleCinemaApp();
  window.app.init();
});
