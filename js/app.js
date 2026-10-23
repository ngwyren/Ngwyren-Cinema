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

    // Lưu trữ cá nhân (Danh sách của tôi, Lịch sử xem & Cài đặt hệ thống - Mặc định trống cho tài khoản mới)
    this.myList = this.loadStorage("apple_cinema_mylist", []);
    this.watchHistory = this.loadStorage("apple_cinema_history", []);
    this.settings = this.loadStorage("apple_cinema_settings", {
      theme: "default",
      glassPercent: 50,
      glassBlur: "standard",
      ambientGlow: true,
      defaultServer: "hls-1",
      defaultQuality: "native-max",
      autoPlayOnOpen: false,
      autoNextEpisode: true,
      defaultLightsOff: false,
      heroAutoRotate: true
    });
    if (this.settings.defaultServer === "dub-1") {
      this.settings.defaultServer = "hls-1";
      this.saveStorage("apple_cinema_settings", this.settings);
    }
    this.currentServerMode = this.settings.defaultServer || "hls-1";
    this.currentQuality = this.settings.defaultQuality || "native-max";

    this.searchDebounce = null;
    this.tagCache = new Map();
    this.countryCache = new Map();
    this.chartsCache = null;
  }

  async init() {
    this.applyTheme();
    this.buildFastIndexes();
    this.setupHeroMovies();
    this.initUserProfile();
    this.bindGlobalEvents();
    this.updateSidebarCounts();

    // Khởi tạo thanh Now Playing mặc định với bộ phim đầu tiên trong lịch sử hoặc ngẫu nhiên từ Hero
    const initialPlaying = this.service.slugMap.get(this.watchHistory[0]?.slug) || this.heroMovies[this.heroIndex] || this.service.movies[0];
    this.setNowPlayingBar(initialPlaying, 0, false);

    // Render giao diện tức thì (0ms)
    this.renderMainView();
    this.startHeroAutoRotate();

    // Trì hoãn đồng bộ ngầm khi trình duyệt rảnh để không gây giật lag lúc mới mở trang
    setTimeout(() => this.syncLivePhimmoi(false), 6000);
  }

  buildFastIndexes() {
    this.tagCache.clear();
    this.countryCache.clear();
    const movies = this.service.movies;
    for (let i = 0; i < movies.length; i++) {
      const m = movies[i];
      if (m.sectionTags) {
        for (let t = 0; t < m.sectionTags.length; t++) {
          const tag = m.sectionTags[t];
          let arr = this.tagCache.get(tag);
          if (!arr) {
            arr = [];
            this.tagCache.set(tag, arr);
          }
          arr.push(m);
        }
      }
      if (m.countrySlug) {
        let cArr = this.countryCache.get(m.countrySlug);
        if (!cArr) {
          cArr = [];
          this.countryCache.set(m.countrySlug, cArr);
        }
        cArr.push(m);
      }
    }
    this.chartsCache = {
      newSingles: movies.filter((m) => m.type === "single").slice(0, 5),
      newSeries: movies.filter((m) => m.type === "series").slice(0, 5),
      topRated: [...movies].sort((a, b) => b.rating - a.rating).slice(0, 5)
    };
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
      if (
        (key === "apple_cinema_mylist" ||
          key === "ngwyren_playback_progress" ||
          key === "ngwyren_user_profile" ||
          key === "apple_cinema_history") &&
        this.triggerCloudSync
      ) {
        this.triggerCloudSync();
      }
    } catch (e) {}
  }

  setupHeroMovies() {
    const candidateSlugs = [
      "thanh-guom-diet-quy-vo-han-thanh-465645",
      "matchbox-phim-dien-anh",
      "squid-game-3-765752",
      "dia-dao-mat-troi-trong-bong-toi",
      "tai-xe-an-danh-phan-3",
      "nhiem-vu-bat-kha-thi-nghiep-bao-phan-2-1",
      "chainsaw-man-the-movie-chuong-reze",
      "phi-vu-dong-troi-2",
      "cau-be-mat-tich-phan-5",
      "chu-thuat-hoi-chien-hoai-ngoc-ngoc-chiet-the-movie",
      "tham-tu-kien-ky-an-khong-dau",
      "good-boy-18",
      "nha-gia-tien",
      "cu-roi-tu-than-2-diem-chet",
      "100-ngay-lua-doi",
      "dich-nhan-kiet-lang-nhan-kiep"
    ];

    // Lọc các phim bom tấn có ảnh nền nét từ ứng viên và catalog
    const seedMovies = candidateSlugs
      .map((s) => this.service.slugMap.get(s))
      .filter((m) => m && m.backdrop);

    const catalogHdMovies = this.service.movies
      .filter((m) => m && m.backdrop && !m.backdrop.includes("nguonc.com") && (m.rating >= 8.0 || m.year >= 2024))
      .slice(0, 45);

    const pool = Array.from(new Set([...seedMovies, ...catalogHdMovies]));

    // Xáo trộn ngẫu nhiên hoàn toàn mỗi lần tải lại trang (Fisher-Yates Shuffle)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Chọn ngẫu nhiên 8 phim xuất sắc & chọn vị trí slide mở đầu ngẫu nhiên (đổi liên tục mỗi lần load web)
    this.heroMovies = pool.slice(0, 8);
    this.heroIndex = Math.floor(Math.random() * this.heroMovies.length);
  }

  /* ==========================================================================
     AMBIENT COLOR & ARTWORK GLOW ENGINE (MINIMAL MONOCHROME MOTION)
     ========================================================================== */
  updateAmbientBackdrop() {
    // Đã tắt hiệu ứng đổi ảnh nền mờ để tối ưu hiệu năng tuyệt đối (0ms GPU lag)
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
    this.buildFastIndexes();
    this.setupHeroMovies();
    this.updateSidebarCounts();

    if (statusText) {
      statusText.textContent = `Trực tuyến (${result.total} phim)`;
    }
    if (syncBtn) syncBtn.disabled = false;

    if (showToast) {
      this.renderMainView();
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
    this.activeGenreFilter = "Tất cả";
    this.currentSegment = "all";
    this.visibleGridLimit = 36;

    // Highlight left floating icon dock, top category pills & mobile bottom dock
    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.classList.toggle("active", el.dataset.nav === navKey);
    });

    // Đồng bộ chính xác thanh Dock bên trái với trang lớn
    this.syncLeftDockIndicator(navKey);
    // Đóng sidebar mobile nếu đang mở
    this.toggleMobileSidebar(false);

    // Cuộn mượt lên đầu trang & hiệu ứng chuyển trang không gian visionOS
    window.scrollTo({ top: 0, behavior: "instant" });
    this.renderMainView();
    this.triggerPageTransition();
  }

  syncNavPillIndicator() {}

  triggerHaptic(type = "light") {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        if (type === "medium") {
          navigator.vibrate(14);
        } else if (type === "heavy") {
          navigator.vibrate([12, 35, 16]);
        } else {
          navigator.vibrate(8);
        }
      } catch (e) {
        // Safe fallback
      }
    }
  }

  syncLeftDockIndicator(navKey) {
    const dockEl = document.getElementById("appleSidebar");
    const indicator = document.getElementById("visionDockIndicator");
    if (!dockEl) return;
    const dockMap = {
      "kham-pha": 0,
      "phim-le": 0,
      "phim-bo": 0,
      "netflix": 0,
      "vietsub": 0,
      "moi-cap-nhat": 0,
      "yeu-thich": 1,
      "lich-su": 1,
      "anime": 2,
      "cai-dat": 3
    };
    const targetIdx = dockMap[navKey] !== undefined ? dockMap[navKey] : 0;

    // Hiệu ứng co giãn thấu kính chất lỏng Liquid Glass
    

    dockEl.style.setProperty("--dock-idx", String(targetIdx));
    document.querySelectorAll(".vision-dock-icon").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.dockIdx) === targetIdx);
    });
  }

  triggerPageTransition() {
    const container = document.getElementById("mainContentWrapper");
    if (container) {
      container.classList.remove("vision-view-enter");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          container.classList.add("vision-view-enter");
        });
      });
    }
  }

  renderLeftSideColumnHTML(contextMovies = null, panelTitle = "Đề Xuất") {
    // Luôn đảm bảo đủ đúng 15 phim mới, ngẫu nhiên hóa mỗi lần tải lại trang
    let list15 = [];
    if (!contextMovies || contextMovies === this.service.movies) {
      if (!this._shuffledTrailers) {
        const topPool = this.service.movies.slice(0, 45);
        for (let i = topPool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [topPool[i], topPool[j]] = [topPool[j], topPool[i]];
        }
        this._shuffledTrailers = topPool.slice(0, 15);
      }
      list15 = this._shuffledTrailers;
    } else {
      list15 = [...contextMovies];
      if (list15.length < 15) {
        for (const m of this.service.movies) {
          if (!list15.some((x) => x.slug === m.slug)) {
            list15.push(m);
            if (list15.length >= 15) break;
          }
        }
      }
    }
    const sourceTrailers = list15.slice(0, 15);
    const continueItems = this.watchHistory
      .map((h) => ({ movie: this.findMovie(h.slug), epIndex: h.epIndex || 0 }))
      .filter((x) => x.movie);

    // Chỉ hiển thị khung Xem Tiếp khi người dùng đã thực sự xem phim (tài khoản mới không hiện rác)
    const continuePanelHTML = continueItems.length > 0 ? `
        <div class="vision-glass-panel">
          <div class="vision-panel-header">
            <span class="vision-panel-title">Xem Tiếp</span>
            <button class="vision-see-all-pill" onclick="app.setNavigation('lich-su')">Lịch sử</button>
          </div>
          <div class="vision-continue-list">
            ${continueItems.slice(0, 5).map((item) => this.renderVisionContinueItemHTML(item.movie, item.epIndex)).join("")}
          </div>
        </div>
    ` : "";

    return `
      <aside class="vision-side-col">
        <div class="vision-glass-panel">
          <div class="vision-panel-header">
            <span class="vision-panel-title">${panelTitle}</span>
            <span class="vision-panel-sort">Hôm nay</span>
          </div>
          <div class="vision-trailer-stack">
            ${sourceTrailers.map((m) => this.renderVisionTrailerCardHTML(m)).join("")}
          </div>
        </div>

        ${continuePanelHTML}
      </aside>
    `;
  }

  pickDistinctCategoryHero(list, navKey) {
    if (!list || list.length === 0) return this.heroMovies[0] || this.service.movies[0];
    const pool = list.filter((m) => m && m.backdrop && !m.backdrop.includes("nguonc.com"));
    const poolToUse = pool.length >= 3 ? pool.slice(0, 15) : list.slice(0, 8);
    // Chọn ngẫu nhiên một phim xuất sắc trong danh mục mỗi lần mở
    return poolToUse[Math.floor(Math.random() * poolToUse.length)] || list[0];
  }

  renderSettingsViewHTML() {
    const s = this.settings || {};
    let glassPercent = 50;
    if (s.glassPercent !== undefined) glassPercent = Number(s.glassPercent);
    else if (s.glassBlur === "clear") glassPercent = 0;
    else if (s.glassBlur === "frost") glassPercent = 100;
    const glassLabel = glassPercent === 0 ? "Trong Suốt" : (glassPercent === 100 ? "Kính Mờ" : "Tiêu Chuẩn");

    return `
      <div class="vision-dashboard-grid">
        ${this.renderLeftSideColumnHTML(this.service.movies, "Đề Xuất")}

        <div class="vision-main-col vision-col-transition">
          <!-- Spatial Settings Hero Header -->
          <section class="vision-settings-banner">
            <div class="vision-settings-banner-left">
              <h1 class="vision-hero-title">Cài Đặt Hệ Thống</h1>
            </div>
            <div class="vision-settings-banner-actions">
              <button class="vision-btn-outline" onclick="app.resetDefaultSettings()">
                Mặc Định
              </button>
            </div>
          </section>

          <!-- Settings Grid (2-Column Glass Cards inside Main Column) -->
          <div class="vision-settings-grid">
            <!-- Card Theme: Giao Diện & Không Gian Thị Giác -->
            <div class="vision-settings-card" style="grid-column: 1 / -1;">
              <div class="vision-settings-card-header">
                <div>
                  <h3>Chủ Đề & Không Gian</h3>
                </div>
              </div>

              <!-- Row 1: Tông Màu -->
              <div class="vision-setting-row">
                <div class="vision-setting-info">
                  <strong>Tông màu</strong>
                </div>
                <div class="vision-setting-pills">
                  <button class="filter-chip ${(s.theme || 'default') === 'default' ? 'active' : ''}" data-theme-btn="default" onclick="app.setThemeMode('default')">
                    Mặc Định
                  </button>
                  <button class="filter-chip ${s.theme === 'midnight' ? 'active' : ''}" data-theme-btn="midnight" onclick="app.setThemeMode('midnight')">
                    Nửa Đêm
                  </button>
                  <button class="filter-chip ${s.theme === 'aurora' ? 'active' : ''}" data-theme-btn="aurora" onclick="app.setThemeMode('aurora')">
                    Cực Quang
                  </button>
                  <button class="filter-chip ${s.theme === 'amber' ? 'active' : ''}" data-theme-btn="amber" onclick="app.setThemeMode('amber')">
                    Hoàng Hôn
                  </button>
                  <button class="filter-chip ${s.theme === 'emerald' ? 'active' : ''}" data-theme-btn="emerald" onclick="app.setThemeMode('emerald')">
                    Lục Bảo
                  </button>
                </div>
              </div>

              <!-- Row 2: Độ mờ kính (Native visionOS Range Slider) -->
              <div class="vision-setting-row" style="flex-direction: column; align-items: stretch; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <div>
                    <strong style="font-size: 0.88rem; color: #ffffff;">Độ mờ kính</strong>
                  </div>
                  <span class="vision-badge" id="glassSliderValueLabel" style="font-size: 0.76rem; font-weight: 700; padding: 4px 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.18); color: #ffffff;">${glassLabel} (${glassPercent}%)</span>
                </div>
                <div class="ios-slider-wrapper">
                  <div class="ios-slider-control">
                    <span class="ios-slider-icon" title="Trong suốt (0%)" onclick="app.setGlassStep(0)" style="cursor: pointer;">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="5" stroke-dasharray="3 3"/>
                      </svg>
                    </span>
                    <input type="range" min="0" max="100" value="${glassPercent}" id="glassNativeRange" class="ios-native-range" style="--range-fill: ${glassPercent}%;" aria-label="Độ mờ kính" />
                    <span class="ios-slider-icon" title="Kính mờ (100%)" onclick="app.setGlassStep(100)" style="cursor: pointer;">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" fill-opacity="0.45"/>
                      </svg>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Row 3: Ánh sáng môi trường -->
              <div class="vision-setting-row">
                <div class="vision-setting-info">
                  <strong>Ánh sáng môi trường</strong>
                </div>
                <button class="vision-toggle-btn ${s.ambientGlow !== false ? 'on' : ''}" id="ambientGlowToggleBtn" onclick="app.toggleAmbientGlow()">
                  <span>${s.ambientGlow !== false ? 'Bật' : 'Tắt'}</span>
                </button>
              </div>
            </div>

            <!-- Card 1: Chất Lượng & Nguồn Phát -->
            <div class="vision-settings-card">
              <div class="vision-settings-card-header">
                <div>
                  <h3>Chất Lượng & Nguồn Phát</h3>
                </div>
              </div>

              <div class="vision-setting-row">
                <div class="vision-setting-info">
                  <strong>Độ phân giải</strong>
                </div>
                <div class="vision-setting-pills">
                  <button class="filter-chip ${s.defaultQuality !== 'Auto' ? 'active' : ''}" onclick="app.updateSetting('defaultQuality', 'native-max')">
                    1080p FHD
                  </button>
                  <button class="filter-chip ${s.defaultQuality === 'Auto' ? 'active' : ''}" onclick="app.updateSetting('defaultQuality', 'Auto')">
                    Tự Động
                  </button>
                </div>
              </div>

              <div class="vision-setting-row">
                <div class="vision-setting-info">
                  <strong>Máy chủ ưu tiên</strong>
                </div>
                <div class="vision-setting-pills">
                  <button class="filter-chip ${s.defaultServer !== 'embed-1' ? 'active' : ''}" onclick="app.updateSetting('defaultServer', 'hls-1')">
                    Server 1
                  </button>
                  <button class="filter-chip ${s.defaultServer === 'embed-1' ? 'active' : ''}" onclick="app.updateSetting('defaultServer', 'embed-1')">
                    Server 2
                  </button>
                </div>
              </div>
            </div>

            <!-- Card 2: Trải Nghiệm Rạp Chiếu -->
            <div class="vision-settings-card">
              <div class="vision-settings-card-header">
                <div>
                  <h3>Trải Nghiệm Rạp Chiếu</h3>
                </div>
              </div>

              <div class="vision-setting-row">
                <div class="vision-setting-info">
                  <strong>Tự động phát</strong>
                </div>
                <button class="vision-toggle-btn ${s.autoPlayOnOpen ? 'on' : ''}" onclick="app.updateSetting('autoPlayOnOpen', ${!s.autoPlayOnOpen})">
                  <span>${s.autoPlayOnOpen ? 'Bật' : 'Tắt'}</span>
                </button>
              </div>

              <div class="vision-setting-row">
                <div class="vision-setting-info">
                  <strong>Tắt đèn rạp</strong>
                </div>
                <button class="vision-toggle-btn ${s.defaultLightsOff ? 'on' : ''}" onclick="app.updateSetting('defaultLightsOff', ${!s.defaultLightsOff})">
                  <span>${s.defaultLightsOff ? 'Bật' : 'Tắt'}</span>
                </button>
              </div>

              <div class="vision-setting-row">
                <div class="vision-setting-info">
                  <strong>Tự xoay Banner</strong>
                </div>
                <button class="vision-toggle-btn ${s.heroAutoRotate !== false ? 'on' : ''}" onclick="app.updateSetting('heroAutoRotate', ${s.heroAutoRotate === false})">
                  <span>${s.heroAutoRotate !== false ? 'Bật' : 'Tắt'}</span>
                </button>
              </div>
            </div>

            <!-- Card 3: Quản Lý Dữ Liệu Cá Nhân -->
            <div class="vision-settings-card" style="grid-column: 1 / -1;">
              <div class="vision-settings-card-header">
                <div>
                  <h3>Quản Lý Dữ Liệu Cá Nhân</h3>
                </div>
              </div>

              <div class="vision-setting-actions-row">
                <button class="vision-btn-outline" onclick="app.setNavigation('yeu-thich')">
                  Phim Đã Lưu (${this.myList.length})
                </button>
                <button class="vision-btn-outline" onclick="app.setNavigation('lich-su')">
                  Lịch Sử (${this.watchHistory.length})
                </button>
                <button class="vision-btn-outline" onclick="app.clearWatchHistory()">
                  Xóa Lịch Sử
                </button>
                <button class="vision-btn-outline" onclick="app.clearMyList()">
                  Xóa Đã Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  initGlassSlider() {
    const range = document.getElementById("glassNativeRange");
    const label = document.getElementById("glassSliderValueLabel");
    if (!range) return;

    const applyPercent = (val, save = false) => {
      const percent = Math.max(0, Math.min(100, Number(val)));
      range.style.setProperty("--range-fill", `${percent}%`);

      // Phổ mờ kính từ 4px (siêu trong suốt thấy rõ phòng) đến 54px (kính mờ đặc bí mật)
      const blurPx = Math.round(4 + (percent / 100) * 50);
      const alpha = (0.15 + (percent / 100) * 0.80).toFixed(2);
      const panelAlpha = (0.02 + (percent / 100) * 0.78).toFixed(2);
      const root = document.documentElement;
      root.style.setProperty("--glass-dyn-blur", `${blurPx}px`);
      root.style.setProperty("--glass-dyn-alpha", `${alpha}`);
      root.style.setProperty("--glass-panel-alpha", `${panelAlpha}`);
      root.setAttribute("data-glass", percent < 25 ? "clear" : (percent > 75 ? "frost" : "standard"));

      if (label) {
        const text = percent < 25 ? "Trong Suốt" : (percent > 75 ? "Kính Mờ" : "Tiêu Chuẩn");
        label.textContent = `${text} (${percent}%)`;
      }

      if (save) {
        this.settings.glassPercent = percent;
        this.settings.glassBlur = percent < 25 ? "clear" : (percent > 75 ? "frost" : "standard");
        this.saveStorage("apple_cinema_settings", this.settings);
      }
    };

    range.oninput = (e) => {
      applyPercent(e.target.value, false);
    };

    range.onchange = (e) => {
      applyPercent(e.target.value, true);
    };
  }

  setGlassStep(percent) {
    this.settings.glassPercent = percent;
    this.settings.glassBlur = percent === 0 ? "clear" : (percent === 100 ? "frost" : "standard");
    this.saveStorage("apple_cinema_settings", this.settings);
    this.applyTheme();
    const range = document.getElementById("glassNativeRange");
    const label = document.getElementById("glassSliderValueLabel");
    if (range) {
      range.value = percent;
      range.style.setProperty("--range-fill", `${percent}%`);
    }
    if (label) {
      const text = percent === 0 ? "Trong Suốt" : (percent === 100 ? "Kính Mờ" : "Tiêu Chuẩn");
      label.textContent = `${text} (${percent}%)`;
    }
  }

  applyTheme() {
    const s = this.settings || {};
    const root = document.documentElement;
    root.setAttribute("data-theme", s.theme || "default");
    root.setAttribute("data-ambient", s.ambientGlow !== false ? "true" : "false");

    let percent = 50;
    if (s.glassPercent !== undefined) percent = Number(s.glassPercent);
    else if (s.glassBlur === "clear") percent = 0;
    else if (s.glassBlur === "frost") percent = 100;

    // Phổ mờ kính: Trong Suốt (0% -> 4px, alpha 0.15), Tiêu Chuẩn (50% -> 29px, alpha 0.55), Kính Mờ (100% -> 54px, alpha 0.95)
    const blurPx = Math.round(4 + (percent / 100) * 50);
    const alpha = (0.15 + (percent / 100) * 0.80).toFixed(2);
    const panelAlpha = (0.02 + (percent / 100) * 0.78).toFixed(2);
    root.style.setProperty("--glass-dyn-blur", `${blurPx}px`);
    root.style.setProperty("--glass-dyn-alpha", `${alpha}`);
    root.style.setProperty("--glass-panel-alpha", `${panelAlpha}`);
    root.setAttribute("data-glass", percent < 25 ? "clear" : (percent > 75 ? "frost" : "standard"));
  }

  setThemeMode(theme) {
    this.settings.theme = theme;
    this.saveStorage("apple_cinema_settings", this.settings);
    this.applyTheme();
    // Cập nhật ngay lập tức DOM không cần render lại toàn bộ (0ms delay)
    document.querySelectorAll("[data-theme-btn]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.themeBtn === theme);
    });
  }

  toggleAmbientGlow() {
    const current = this.settings.ambientGlow !== false;
    this.settings.ambientGlow = !current;
    this.saveStorage("apple_cinema_settings", this.settings);
    this.applyTheme();
    const btn = document.getElementById("ambientGlowToggleBtn");
    if (btn) {
      btn.classList.toggle("on", this.settings.ambientGlow);
      const span = btn.querySelector("span");
      if (span) span.textContent = this.settings.ambientGlow ? "Bật" : "Tắt";
    }
  }

  updateSetting(key, value) {
    this.settings[key] = value;
    this.saveStorage("apple_cinema_settings", this.settings);
    if (key === "theme" || key === "glassBlur" || key === "ambientGlow") this.applyTheme();
    if (key === "defaultServer") this.currentServerMode = value;
    if (key === "defaultQuality") this.currentQuality = value;
    if (key === "defaultLightsOff") this.lightsOff = Boolean(value);
    if (this.currentNav === "cai-dat") {
      this.renderMainView();
    }
    this.showToast("Đã lưu thay đổi cài đặt hệ thống");
  }

  resetDefaultSettings() {
    this.settings = {
      theme: "default",
      glassPercent: 50,
      glassBlur: "standard",
      ambientGlow: true,
      defaultServer: "hls-1",
      defaultQuality: "native-max",
      autoPlayOnOpen: false,
      autoNextEpisode: true,
      defaultLightsOff: false,
      heroAutoRotate: true
    };
    this.saveStorage("apple_cinema_settings", this.settings);
    this.currentServerMode = "hls-1";
    this.currentQuality = "native-max";
    this.applyTheme();
    if (this.currentNav === "cai-dat") {
      this.renderMainView();
    }
    this.showToast("Đã khôi phục cài đặt mặc định");
  }

  clearWatchHistory() {
    this.watchHistory = [];
    this.saveStorage("apple_cinema_history", this.watchHistory);
    this.updateSidebarCounts();
    this.renderMainView();
    this.showToast("Đã xóa toàn bộ lịch sử xem phim");
  }

  clearMyList() {
    this.myList = [];
    this.saveStorage("apple_cinema_mylist", this.myList);
    this.updateSidebarCounts();
    this.renderMainView();
    this.showToast("Đã làm trống danh sách phim đã lưu");
  }

  renderMainView() {
    const container = document.getElementById("mainContentWrapper");
    if (!container) return;

    // Trang Cài Đặt Hệ Thống (Khi bấm icon bánh răng ở thanh bên trái)
    if (this.currentNav === "cai-dat") {
      container.innerHTML = this.renderSettingsViewHTML();
      this.initGlassSlider();
      return;
    }

    const isDefaultExplore =
      this.currentNav === "kham-pha" &&
      this.activeGenreFilter === "Tất cả" &&
      this.currentSegment === "all";

    if (isDefaultExplore) {
      const youMightLike = this.service.movies.slice(1, 5);
      const animeFeatured = this.getMoviesByTag("anime").slice(0, 8);
      const netflixFeatured = this.getMoviesByTag("netflix").slice(0, 8);
      const koreanFeatured = this.getMoviesByCountry("han-quoc").slice(0, 8);

      container.innerHTML = `
        <div class="vision-dashboard-grid">
          ${this.renderLeftSideColumnHTML(this.service.movies, "Đề Xuất")}

          <!-- RIGHT MAIN COLUMN: HERO BANNER + GỢI Ý CHO BẠN + CURATED ROWS -->
          <div class="vision-main-col vision-col-transition">
            ${this.renderHeroHTML()}

            <!-- Gợi Ý Cho Bạn (4-column visionOS cards) -->
            <section class="vision-shelf-section">
              <div class="vision-shelf-header">
                <h2 class="vision-shelf-title">Gợi Ý Cho Bạn</h2>
                <button class="vision-see-all-pill" onclick="app.setNavigation('moi-cap-nhat')">Xem Tất Cả</button>
              </div>
              <div class="vision-cards-grid-4">
                ${youMightLike.map((m) => this.renderVisionFeatureCardHTML(m)).join("")}
              </div>
            </section>

            <!-- Quick Genre Chips -->
            ${this.renderGenreChipsHTML()}

            <!-- Anime Row -->
            <section class="vision-shelf-section">
              <div class="vision-shelf-header">
                <h2 class="vision-shelf-title">Anime & Hoạt Hình</h2>
                <button class="vision-see-all-pill" onclick="app.setNavigation('anime')">
                  Xem Tất Cả (${this.getMoviesByTag("anime").length})
                </button>
              </div>
              <div class="vision-cards-grid-4">
                ${animeFeatured.map((m) => this.renderVisionFeatureCardHTML(m)).join("")}
              </div>
            </section>

            <!-- Netflix Row -->
            <section class="vision-shelf-section">
              <div class="vision-shelf-header">
                <h2 class="vision-shelf-title">Phim Độc Quyền Netflix</h2>
                <button class="vision-see-all-pill" onclick="app.setNavigation('netflix')">
                  Xem Tất Cả (${this.getMoviesByTag("netflix").length})
                </button>
              </div>
              <div class="vision-cards-grid-4">
                ${netflixFeatured.map((m) => this.renderVisionFeatureCardHTML(m)).join("")}
              </div>
            </section>

            <!-- Korean Row -->
            <section class="vision-shelf-section">
              <div class="vision-shelf-header">
                <h2 class="vision-shelf-title">Phim Hàn Quốc Thịnh Hành</h2>
                <button class="vision-see-all-pill" onclick="app.setNavigation('han-quoc')">
                  Xem Tất Cả (${this.getMoviesByCountry("han-quoc").length})
                </button>
              </div>
              <div class="vision-cards-grid-4">
                ${koreanFeatured.map((m) => this.renderVisionFeatureCardHTML(m)).join("")}
              </div>
            </section>
          </div>
        </div>
      `;
      return;
    }

    // Chế độ danh mục (Đã Lưu, Lịch Sử, Anime, Movies, TV Series, Netflix, Vietsub...)
    // GIỮ NGUYÊN 100% SHAPE 2 CỘT VISION OS NHƯNG THAY ĐỔI RÕ RÀNG NỘI DUNG TỪNG TRANG
    const { title, subtitle, list } = this.getFilteredCatalog();
    const visibleList = list.slice(0, this.visibleGridLimit);
    const distinctListForLeft = list.filter((m) => m.slug !== "thanh-guom-diet-quy-vo-han-thanh-465645");
    const categoryHeroMovie = this.pickDistinctCategoryHero(list, this.currentNav);
    const isPersonalPage = this.currentNav === "yeu-thich" || this.currentNav === "lich-su";

    container.innerHTML = `
      <div class="vision-dashboard-grid">
        ${(() => {
        const shortMap = {
          "anime": "Đề Xuất Anime",
          "phim-le": "Đề Xuất Phim Lẻ",
          "phim-bo": "Đề Xuất Phim Bộ",
          "netflix": "Đề Xuất Netflix",
          "vietsub": "Đề Xuất"
        };
        const shortTitle = shortMap[this.currentNav] || "Đề Xuất";
        return this.renderLeftSideColumnHTML(distinctListForLeft.length >= 2 ? distinctListForLeft : list, shortTitle);
      })()}

        <div class="vision-main-col vision-col-transition">
          <!-- Category Header Banner / Hero -->
          ${
            isPersonalPage
              ? `<section class="vision-settings-banner">
                   <div class="vision-settings-banner-left">
                     <span class="vision-trending-pill">
                       <i class="fas ${this.currentNav === "yeu-thich" ? "fa-star" : "fa-clock-rotate-left"}"></i>
                       Thư Viện Cá Nhân
                     </span>
                     <h1 class="vision-hero-title" style="margin-top: 8px;">${title} (${list.length} phim)</h1>
                   </div>
                   <div class="vision-settings-banner-actions">
                     ${
                       this.currentNav === "yeu-thich" && list.length > 0
                         ? `<button class="vision-btn-outline" onclick="app.clearMyList()"><i class="fas fa-trash-can"></i> Xóa Danh Sách</button>`
                         : this.currentNav === "lich-su" && list.length > 0
                         ? `<button class="vision-btn-outline" onclick="app.clearWatchHistory()"><i class="fas fa-trash-can"></i> Xóa Lịch Sử</button>`
                         : ""
                     }
                     <button class="vision-btn-watch" onclick="app.resetAllFilters()">
                       <i class="fas fa-house"></i> Về Khám Phá
                     </button>
                   </div>
                 </section>`
              : this.renderHeroHTML(categoryHeroMovie, `${title} (${list.length} phim)`)
          }

          ${this.renderGenreChipsHTML()}

          <section class="vision-shelf-section">
            ${
              !isPersonalPage
                ? `<div class="vision-shelf-header">
                     <h2 class="vision-shelf-title">${title}</h2>
                     <button class="vision-see-all-pill" onclick="app.resetAllFilters()">
                       <i class="fas fa-rotate-left"></i> Về Khám Phá
                     </button>
                   </div>`
                : ""
            }
            ${
              visibleList.length > 0
                ? `<div class="vision-cards-grid-4">${visibleList.map((m) => this.renderVisionFeatureCardHTML(m)).join("")}</div>
                   ${this.renderLoadMoreButtonsHTML(list.length)}`
                : `<div style="padding: 60px 20px; text-align: center; background: rgba(255,255,255,0.04); border-radius: 26px; border: 1px solid rgba(255,255,255,0.12);">
                    <i class="fas fa-film" style="font-size: 2.5rem; color: #ffffff; margin-bottom: 14px;"></i>
                    <h3 style="margin-bottom: 18px; font-weight: 600;">Chưa có phim trong mục này</h3>
                    <button class="vision-btn-watch" onclick="app.resetAllFilters()">Khám Phá Kho Phim</button>
                  </div>`
            }
          </section>
        </div>
      </div>
    `;
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

    // Lọc theo thể loại (Genre chip)
    if (this.activeGenreFilter && this.activeGenreFilter !== "Tất cả") {
      base = base.filter((m) =>
        m.genres.some((g) => g.toLowerCase() === this.activeGenreFilter.toLowerCase())
      );
      title = `Thể loại: ${this.activeGenreFilter}`;
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
     VISION OS SPATIAL HTML BUILDERS (HERO, TRAILER STACK, CONTINUE & CARDS)
     ========================================================================== */
  renderHeroHTML(customMovie = null, customKicker = "Thịnh Hành") {
    const movie = customMovie || this.heroMovies[this.heroIndex] || this.service.movies[0];
    if (!movie) return "";
    const inMyList = this.isInMyList(movie);
    const prevIdx = (this.heroIndex - 1 + this.heroMovies.length) % this.heroMovies.length;
    const nextIdx = (this.heroIndex + 1) % this.heroMovies.length;

    return `
      <section class="vision-hero-banner" id="heroShowcase" onmouseenter="app.pauseHeroAutoRotate()" onmouseleave="app.resumeHeroAutoRotate()">
        <img class="vision-hero-bg" src="${movie.backdrop || movie.poster}" alt="${movie.title}" decoding="async" />
        <div class="vision-hero-overlay"></div>

        <div class="vision-hero-top">
          <span class="vision-trending-pill">${customKicker}</span>
          <div class="vision-hero-dots">
            ${this.heroMovies.map((_, i) => `
              <button class="vision-hero-dot ${i === this.heroIndex ? "active" : ""}" onclick="app.setHeroSlide(${i})" aria-label="Slide ${i + 1}"></button>
            `).join("")}
          </div>
        </div>

        <div class="vision-hero-bottom">
          <div class="vision-hero-info">
            <div class="vision-hero-genres">
              ${movie.genres.slice(0, 3).map((g) => `<span class="vision-genre-tag">${g}</span>`).join("")}
              <span class="vision-genre-tag">${movie.quality} • ${movie.language}</span>
            </div>

            <h1 class="vision-hero-title">${movie.title}</h1>
            <p class="vision-hero-desc">${movie.synopsis}</p>

            <div class="vision-hero-actions">
              <button class="vision-btn-watch" onclick="app.openMovieModal('${movie.slug}', true)">
                <i class="fas fa-play"></i> Xem Ngay
              </button>
              <button class="vision-btn-outline" onclick="app.toggleMyList('${movie.slug}', event)">
                <i class="fas ${inMyList ? "fa-check" : "fa-download"}"></i>
                ${inMyList ? "Đã Lưu" : "Lưu Phim"}
              </button>
              <button class="vision-btn-dots" onclick="app.openMovieModal('${movie.slug}', false)" title="Chi tiết & Tập phim">
                <i class="fas fa-ellipsis"></i>
              </button>
            </div>
          </div>

          <div class="vision-hero-arrows">
            <button class="vision-arrow-btn" onclick="app.setHeroSlide(${prevIdx})" aria-label="Slide trước">
              <i class="fas fa-chevron-left"></i>
            </button>
            <button class="vision-arrow-btn" onclick="app.setHeroSlide(${nextIdx})" aria-label="Slide tiếp">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </section>
    `;
  }

  renderVisionTrailerCardHTML(movie) {
    return `
      <article class="vision-trailer-card" onclick="app.openMovieModal('${movie.slug}', true)">
        <img src="${movie.backdrop || movie.poster}" alt="${movie.title}" loading="lazy" decoding="async"
             onerror="this.src='https://phimmoiz.one/wp-content/uploads/2026/10/matchbox-phim-dien-anh-poster.webp'" />
        <div class="vision-trailer-overlay">
          <div class="vision-trailer-title">${movie.title}</div>
          <button class="vision-trailer-play" onclick="event.stopPropagation(); app.openMovieModal('${movie.slug}', true)" aria-label="Phát">
            <i class="fas fa-play"></i>
          </button>
        </div>
      </article>
    `;
  }

  renderVisionContinueItemHTML(movie, epIndex = 0) {
    const epName = movie.episodes?.[epIndex]?.name || movie.episodeCurrent || "Tập 1";
    const prog = this.getPlaybackProgress(movie.slug, epIndex);
    const pct = prog ? prog.percentage : 35;
    const timeText = prog ? `Đã xem ${this.formatSeconds(prog.currentTime)} (${pct}%)` : `${epName} • ${movie.quality}`;

    return `
      <div class="vision-continue-item" onclick="app.openMovieModal('${movie.slug}', true, ${epIndex})" title="Tiếp tục xem ${movie.title}">
        <div class="vision-continue-thumb-box">
          <img class="vision-continue-thumb" src="${movie.poster}" alt="${movie.title}" loading="lazy" decoding="async" />
          <div class="vision-continue-progress-bg">
            <div class="vision-continue-progress-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
        <div class="vision-continue-text">
          <div class="vision-continue-title">${movie.title}</div>
          <div class="vision-continue-sub">${timeText}</div>
        </div>
        <button class="vision-continue-play" aria-label="Phát tiếp">
          <i class="fas fa-play"></i>
        </button>
      </div>
    `;
  }

  renderVisionFeatureCardHTML(movie) {
    const mainGenre = movie.genres?.[0] || "Cinema";
    return `
      <article class="vision-feature-card" onclick="app.openMovieModal('${movie.slug}', false)">
        <img class="vision-feature-img" src="${movie.poster}" alt="${movie.title}" loading="lazy" decoding="async"
             onerror="this.src='https://phimmoiz.one/wp-content/uploads/2026/10/matchbox-phim-dien-anh-poster.webp'" />
        <div class="vision-feature-shade"></div>

        <button class="vision-card-more" onclick="event.stopPropagation(); app.toggleMyList('${movie.slug}', event)" title="Lưu vào danh sách">
          <i class="fas ${this.isInMyList(movie) ? "fa-check" : "fa-ellipsis"}"></i>
        </button>

        <div class="vision-feature-bottom">
          <div class="vision-feature-meta">
            <span class="vision-card-genre">${mainGenre}</span>
            <h3 class="vision-card-title" title="${movie.title}">${movie.title}</h3>
            <p class="vision-card-desc">${movie.originTitle} (${movie.year}) • ${movie.episodeCurrent || movie.quality}</p>
          </div>
          <button class="vision-card-play-white" onclick="event.stopPropagation(); app.openMovieModal('${movie.slug}', true)" title="Xem ngay">
            <i class="fas fa-play"></i>
          </button>
        </div>
      </article>
    `;
  }

  renderGenreChipsHTML() {
    const genres = [
      { label: "Tất cả", icon: "fa-sparkles" },
      { label: "Hành Động", icon: "fa-fire" },
      { label: "Bí Ẩn", icon: "fa-user-secret" },
      { label: "Cổ Trang", icon: "fa-scroll" },
      { label: "Tình Cảm", icon: "fa-heart" },
      { label: "Anime", icon: "fa-dragon" },
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

  renderCarouselSection(title, subtitle, movies, navTarget, maxItems = 12) {
    const trackId = `track-${Math.random().toString(36).slice(2, 8)}`;
    const displayMovies = (movies || []).slice(0, maxItems);
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
                    Xem tất cả (${(movies || []).length}) <i class="fas fa-chevron-right" style="font-size: 0.72rem;"></i>
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
          ${displayMovies.map((m) => this.renderMovieCardHTML(m)).join("")}
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
    if (!this.chartsCache) this.buildFastIndexes();
    const { newSingles, newSeries, topRated } = this.chartsCache;

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
          <img src="${movie.poster}" alt="${movie.title}" loading="lazy" decoding="async"
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

    const shouldAutoPlay = Boolean(autoPlay || this.settings?.autoPlayOnOpen);
    const defaultSrv = this.settings?.defaultServer || "hls-1";

    this.stopModalVideo();
    this.selectedMovie = movie;
    this.currentEpisodeIndex = epIndex;
    this.currentQuality = this.settings?.defaultQuality || "native-max";
    this.lightsOff = Boolean(this.settings?.defaultLightsOff);
    this.ActiveModalTab = "related"; // Luôn ưu tiên hiển thị Nội dung tương tự kiểu Netflix + Tập phim
    this.updateAmbientBackdrop(movie);

    const modalBackdrop = document.getElementById("movieDetailModal");
    if (!modalBackdrop) return;

    this.renderModalContent(movie, shouldAutoPlay);
    modalBackdrop.classList.add("open");
    modalBackdrop.classList.toggle("lights-off", this.lightsOff);
    document.body.style.overflow = "hidden";
    document.body.classList.add("modal-open");

    // Tự động kéo mượt lên đầu Modal khi bấm chọn phim khác ở mục Nội Dung Tương Tự / Cùng Thể Loại
    modalBackdrop.scrollTo({ top: 0, behavior: "smooth" });
    const sheet = document.getElementById("movieDetailSheet");
    if (sheet) {
      sheet.scrollTo({ top: 0, behavior: "smooth" });
      sheet.classList.remove("modal-movie-switch");
      void sheet.offsetWidth;
      sheet.classList.add("modal-movie-switch");
    }

    const prevEpSource = movie.episodes?.[epIndex]?.source || "";

    if (shouldAutoPlay) {
      this.startVideoPlayback(movie, epIndex, defaultSrv);
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
    document.body.classList.remove("modal-open");
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
                ${
                  (() => {
                    const savedProg = this.getPlaybackProgress(movie.slug, this.currentEpisodeIndex);
                    return savedProg && savedProg.currentTime > 10 && savedProg.percentage < 95
                      ? `<i class="fas fa-play"></i> Tiếp tục từ ${this.formatSeconds(savedProg.currentTime)} (${savedProg.percentage}%)`
                      : `<i class="fas fa-play"></i> Phát ${currentEp ? currentEp.name : "Ngay"}`;
                  })()
                }
              </button>
              ${
                (() => {
                  const savedProg = this.getPlaybackProgress(movie.slug, this.currentEpisodeIndex);
                  return savedProg && savedProg.currentTime > 10
                    ? `<button class="btn-glass-secondary" onclick="app.restartPlayback()" title="Xem lại từ đầu 00:00"><i class="fas fa-rotate-left"></i> Từ đầu</button>`
                    : "";
                })()
              }
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

      <!-- Server & Stream Switcher Toolbar (Multi-Source Server 1 / Server 2 & 4K/2K Quality Switcher) -->
      <div class="player-toolbar">
        <div class="player-toolbar-left">
          <span class="server-label"><i class="fas fa-server"></i> Nguồn phát:</span>
          <button class="server-btn ${this.currentServerMode === "hls-1" || !this.currentServerMode ? "active" : ""}" id="srvBtnHls1"
                  onclick="app.startVideoPlayback(app.selectedMovie, app.currentEpisodeIndex, 'hls-1')" title="Phát Server 1 chất lượng tốt nhất">
            <i class="fas fa-server"></i> Server 1
          </button>
          ${
            movie.nguoncEpisodes && movie.nguoncEpisodes.length > 0
              ? `<button class="server-btn ${this.currentServerMode === "embed-1" ? "active" : ""}" id="srvBtnEmbed1"
                        onclick="app.startVideoPlayback(app.selectedMovie, app.currentEpisodeIndex, 'embed-1')" title="Phát Server 2">
                  <i class="fas fa-server"></i> Server 2
                </button>`
              : ""
          }
          ${
            movie.dubEpisodes && movie.dubEpisodes.length > 0
              ? `<button class="server-btn ${this.currentServerMode === "dub-1" ? "active" : ""}" id="srvBtnDub1"
                        onclick="app.startVideoPlayback(app.selectedMovie, app.currentEpisodeIndex, 'dub-1')" title="Phát bản Thuyết Minh">
                  <i class="fas fa-microphone"></i> Thuyết Minh
                </button>`
              : ""
          }
          ${
            movie.trailerUrl
              ? `<button class="server-btn ${this.currentServerMode === "trailer" ? "active" : ""}" id="srvBtnTrailer"
                        onclick="app.startVideoPlayback(app.selectedMovie, app.currentEpisodeIndex, 'trailer')" title="Xem Trailer">
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

    // Tự động kéo mượt lên đầu Modal để thấy ngay khung phát video khi bấm chọn tập phim ở dưới
    const modalBackdrop = document.getElementById("movieDetailModal");
    const sheet = document.getElementById("movieDetailSheet");
    modalBackdrop?.scrollTo({ top: 0, behavior: "smooth" });
    sheet?.scrollTo({ top: 0, behavior: "smooth" });

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
        // Tự động tua tiếp đến đoạn đã xem dở
        const savedProg = this.getPlaybackProgress(movie.slug, epIndex);
        if (savedProg && savedProg.currentTime > 5 && savedProg.percentage < 95) {
          videoEl.currentTime = savedProg.currentTime;
          this.showToast(`▶ Đang tiếp tục xem từ ${this.formatSeconds(savedProg.currentTime)} (${savedProg.percentage}%)`);
        }
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
        const savedProg = this.getPlaybackProgress(movie.slug, epIndex);
        if (savedProg && savedProg.currentTime > 5 && savedProg.percentage < 95) {
          videoEl.currentTime = savedProg.currentTime;
          this.showToast(`▶ Đang tiếp tục xem từ ${this.formatSeconds(savedProg.currentTime)} (${savedProg.percentage}%)`);
        }
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

    // Đồng bộ thanh thời gian với Apple Music Now Playing Bar & lưu xem tiếp tục
    videoEl.ontimeupdate = () => {
      if (!videoEl.duration) return;
      const pct = Math.min(100, (videoEl.currentTime / videoEl.duration) * 100);
      const fill = document.getElementById("nowPlayingScrubberFill");
      const curTime = document.getElementById("nowPlayingCurrentTime");
      const totTime = document.getElementById("nowPlayingTotalTime");
      if (fill) fill.style.width = `${pct}%`;
      if (curTime) curTime.textContent = this.formatSeconds(videoEl.currentTime);
      if (totTime) totTime.textContent = this.formatSeconds(videoEl.duration);

      // Đồng bộ timeline cho Dynamic Island mở rộng
      const islandFill = document.getElementById("nowPlayingIslandScrubFill");
      const islandCur = document.getElementById("nowPlayingIslandCurrentTime");
      const islandTot = document.getElementById("nowPlayingIslandTotalTime");
      if (islandFill) islandFill.style.width = `${pct}%`;
      if (islandCur) islandCur.textContent = this.formatSeconds(videoEl.currentTime);
      if (islandTot) islandTot.textContent = this.formatSeconds(videoEl.duration);

      // Tự động lưu vị trí thời gian thực nếu thoát giữa chừng
      if (videoEl.currentTime > 5 && (!videoEl._lastSavedPos || Math.abs(videoEl.currentTime - videoEl._lastSavedPos) >= 3)) {
        videoEl._lastSavedPos = videoEl.currentTime;
        if (this.selectedMovie) {
          this.savePlaybackProgress(this.selectedMovie.slug, this.currentEpisodeIndex, videoEl.currentTime, videoEl.duration);
        }
      }
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
    if (maxDim >= 1800 || h >= 1000) return "Full HD 1080p";
    if (maxDim >= 1200 || h >= 680) return "HD 720p";
    if (maxDim >= 800 || h >= 460) return "480p";
    if (maxDim > 0) return `${h}p`;
    return "Full HD 1080p";
  }

  buildQualityButtonsHTML() {
    return `<button class="quality-pill-btn active" data-quality="native-max" title="Độ phân giải Full HD sắc nét">
      1080p
    </button>`;
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
    const nativeInfo = `${nativeTier.toUpperCase()} (${w}×${h} • ${mbps} Mbps)`;

    if (q && q.startsWith("level-")) {
      const idx = parseInt(q.replace("level-", ""), 10);
      const lvl = this.detectedHlsLevels.find((l) => l.index === idx);
      if (lvl) return `LUỒNG ${lvl.detailLabel.toUpperCase()}`;
    }
    if (q === "Auto") {
      return `AUTO ABR • ĐANG PHÁT ${nativeInfo}`;
    }
    return `CHẤT LƯỢNG TỐT NHẤT • ${nativeInfo}`;
  }

  getQualityVideoClass() {
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
    const videoEl = document.getElementById("hlsVideoElement");
    if (videoEl && this.selectedMovie && videoEl.currentTime > 5 && videoEl.duration) {
      this.savePlaybackProgress(this.selectedMovie.slug, this.currentEpisodeIndex, videoEl.currentTime, videoEl.duration);
    }
    this.destroyHls();
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute("src");
    }
    const iframeEl = document.getElementById("trailerIframeElement");
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
     APPLE MUSIC "NOW PLAYING" & ALCOVE DYNAMIC ISLAND CONTROLLER
     ========================================================================== */
  setNowPlayingBar(movie, epIndex = 0, playing = true) {
    if (!movie) return;
    this.playingMovie = movie;
    this.currentEpisodeIndex = epIndex;
    this.isPlaying = playing;

    const ep = (movie.episodes && movie.episodes[epIndex]) || (movie.episodes && movie.episodes[0]);
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

    // Đồng bộ thông tin sang bản mở rộng Dynamic Island (Alcove style)
    const islandBackdrop = document.getElementById("nowPlayingIslandBackdrop");
    const islandTitle = document.getElementById("nowPlayingIslandTitle");
    const islandDuration = document.getElementById("nowPlayingIslandDuration");
    const islandQuality = document.getElementById("nowPlayingIslandQuality");
    const islandLang = document.getElementById("nowPlayingIslandLang");
    const islandEp = document.getElementById("nowPlayingIslandEp");
    const islandPlayIcon = document.getElementById("nowPlayingIslandPlayIcon");

    if (islandBackdrop) islandBackdrop.src = movie.backdrop || movie.poster;
    if (islandTitle) islandTitle.textContent = movie.title;
    if (islandDuration) islandDuration.textContent = movie.duration || "Full HD";
    if (islandQuality) islandQuality.textContent = movie.quality || "FHD";
    if (islandLang) islandLang.textContent = movie.language || "Vietsub";
    if (islandEp) islandEp.textContent = ep ? ep.name : "Full";
    if (islandPlayIcon) islandPlayIcon.className = playing ? "fas fa-pause" : "fas fa-play";
    const miniCenterPlay = document.getElementById("miniScreenCenterPlayIcon");
    if (miniCenterPlay) miniCenterPlay.className = playing ? "fas fa-pause" : "fas fa-play";
  }

  seekRelative(seconds) {
    const videoEl = document.getElementById("hlsVideoElement");
    if (videoEl && !isNaN(videoEl.duration)) {
      videoEl.currentTime = Math.max(0, Math.min(videoEl.duration, videoEl.currentTime + seconds));
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

    // 1. TÌM KIẾM TỨC THÌ 0ms VỚI THUẬT TOÁN ĐIỂM CHUẨN XÁC TỪ KHÓA (SMART RELEVANCE RANKING)
    const q = query.toLowerCase();
    const scored = [];
    const movies = this.service.movies;
    for (let i = 0; i < movies.length; i++) {
      const m = movies[i];
      const t = (m.title || "").toLowerCase();
      const o = (m.originTitle || "").toLowerCase();
      let score = 0;

      if (t === q || o === q) {
        score = 250; // Trùng khớp hoàn toàn 100%
      } else if (t.startsWith(q)) {
        score = 180; // Tên tiếng Việt bắt đầu bằng từ khóa (ví dụ: "Baby Đến Rồi")
      } else if (o.startsWith(q)) {
        score = 150; // Tên gốc bắt đầu bằng từ khóa (ví dụ: "Baby Bandito")
      } else if (t.includes(q)) {
        score = 110; // Tên tiếng Việt chứa từ khóa (ví dụ: "Kế Hoạch Baby")
      } else if (o.includes(q)) {
        score = 90; // Tên gốc chứa từ khóa (ví dụ: "Win My Baby Back")
      } else {
        if (!m._metaSearch) {
          m._metaSearch = `${(m.genres || []).join(" ")} ${(m.cast || []).join(" ")} ${m.director || ""}`.toLowerCase();
        }
        if (m._metaSearch.includes(q)) {
          score = 25; // Chỉ nằm trong diễn viên / thể loại
        }
      }

      if (score > 0) {
        scored.push({ movie: m, score });
      }
    }

    // Sắp xếp ưu tiên độ khớp từ khóa cao nhất lên đầu, tiếp đến năm phát hành
    scored.sort((a, b) => b.score - a.score || (b.movie.year || 0) - (a.movie.year || 0));
    const quickMatches = scored.slice(0, 8).map((it) => it.movie);

    // Hiển thị NGAY LẬP TỨC (0ms) cho người dùng mà không cần chờ đợi
    this.renderSearchDropdown(query, quickMatches, false);

    // 2. TÌM NÂNG CAO TRỰC TUYẾN PHIMAPI (Debounce siêu tốc 120ms để mở rộng kết quả)
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(async () => {
      const fullMatches = await this.service.searchMovies(query);
      const currentInput = (document.getElementById("topSearchInput")?.value || "").trim();
      if (currentInput === query) {
        this.lastSearchQuery = query;
        this.lastSearchResults = fullMatches;
        this.renderSearchDropdown(query, fullMatches.slice(0, 8), true);
      }
    }, 120);
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
              <img src="${m.poster}" alt="${m.title}" loading="lazy" />
              <div class="search-suggestion-info">
                <div class="search-suggestion-title">${m.title}</div>
                <div class="search-suggestion-meta">
                  <span class="badge-mini">${m.quality || "FHD"}</span>
                  <span class="badge-mini">${m.year || 2026}</span>
                  <span class="search-genre-tag">${(m.genres && m.genres[0]) || m.country || "Phim"}</span>
                </div>
              </div>
              <i class="fas fa-play-circle" style="font-size: 1.25rem; color: rgba(255, 255, 255, 0.85); flex-shrink: 0;"></i>
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
    window.scrollTo({ top: 0, behavior: "instant" });
    this.renderMainView();
    this.triggerPageTransition();
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
    if (genreLabel === "Anime") {
      this.setNavigation("anime");
      return;
    }
    this.activeGenreFilter = genreLabel;
    this.syncLeftDockIndicator(this.currentNav);
    this.renderMainView();
    this.triggerPageTransition();
  }

  filterByGenreFromModal(genreLabel) {
    this.closeMovieModal();
    if (genreLabel === "Anime") {
      this.setNavigation("anime");
      return;
    }
    this.activeGenreFilter = genreLabel;
    this.syncLeftDockIndicator(this.currentNav);
    window.scrollTo({ top: 0, behavior: "instant" });
    this.renderMainView();
    this.triggerPageTransition();
  }

  filterByPerson(personName) {
    this.closeMovieModal();
    this.customFilterValue = personName;
    this.currentNav = "person-filter";
    this.syncLeftDockIndicator("kham-pha");
    window.scrollTo({ top: 0, behavior: "instant" });
    this.renderMainView();
    this.triggerPageTransition();
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
     HERO CAROUSEL & HELPERS (CONTINUOUS AUTO-ROTATE & DOTS)
     ========================================================================== */
  startHeroAutoRotate() {
    clearInterval(this.heroTimer);
    this.heroTimer = setInterval(() => {
      if (
        this.settings?.heroAutoRotate !== false &&
        this.currentNav === "kham-pha" &&
        !this.isHeroPaused &&
        !document.hidden &&
        window.scrollY < 700 &&
        !document.getElementById("movieDetailModal")?.classList.contains("open") &&
        !document.getElementById("authModal")?.classList.contains("open")
      ) {
        this.setHeroSlide((this.heroIndex + 1) % this.heroMovies.length);
      }
    }, 5000);
  }

  pauseHeroAutoRotate() {
    this.isHeroPaused = true;
  }

  resumeHeroAutoRotate() {
    this.isHeroPaused = false;
  }

  setHeroSlide(index) {
    this.heroIndex = index;
    const heroEl = document.getElementById("heroShowcase");
    if (heroEl) {
      heroEl.outerHTML = this.renderHeroHTML();
      const newHero = document.getElementById("heroShowcase");
      if (newHero) {
        newHero.classList.remove("vision-hero-slide-anim");
        void newHero.offsetWidth;
        newHero.classList.add("vision-hero-slide-anim");
      }
    }
    this.startHeroAutoRotate();
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
    return this.tagCache.get(tag) || [];
  }

  getMoviesByCountry(countrySlug) {
    return this.countryCache.get(countrySlug) || [];
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
    // Tắt toàn bộ thông báo toast theo yêu cầu người dùng
    return;
  }

  bindGlobalEvents() {
    // Apple Haptic Feedback on touch & click
    document.addEventListener(
      "pointerdown",
      (e) => {
        const interactive = e.target.closest(
          "button, a, .vision-nav-pill, .vision-dock-icon, .dock-tab-btn, .filter-chip, .vision-movie-card, .vision-feature-card, .mini-ctrl-btn, .mini-play-glow-btn, .mini-cinema-expand-btn, .btn-action, .quality-pill-btn, .server-btn"
        );
        if (interactive) {
          this.triggerHaptic("light");
        }
      },
      { passive: true }
    );

    // Dynamic Liquid Nav Pill Indicator sync
    window.addEventListener("resize", () => this.syncNavPillIndicator(), { passive: true });
    const navPillsBox = document.getElementById("visionNavPills");
    if (navPillsBox) {
      navPillsBox.addEventListener("scroll", () => this.syncNavPillIndicator(), { passive: true });
    }
    setTimeout(() => this.syncNavPillIndicator(), 150);
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

    // Đóng dropdown tìm kiếm hoặc Dynamic Island khi click ra ngoài
    document.addEventListener("click", (e) => {
      const searchBox = document.querySelector(".topbar-search-container");
      if (searchBox && !searchBox.contains(e.target)) {
        document.getElementById("searchDropdown")?.classList.remove("open");
      }
      const playerBar = document.getElementById("applePlayerBar");
      if (playerBar && playerBar.classList.contains("is-expanded") && !playerBar.contains(e.target)) {
        playerBar.classList.remove("is-expanded");
      }
    });

    // Phím tắt bàn phím Desktop chuẩn Rạp Phim:
    // Ctrl+K hoặc /: Tìm kiếm
    // Space: Play / Pause (video đang mở hoặc thanh Now Playing)
    // F: Toàn màn hình video (Fullscreen)
    // M: Bật / Tắt tiếng (Mute / Unmute)
    // ESC: Đóng Modal & Dropdown
    document.addEventListener("keydown", (e) => {
      const target = e.target;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        topInput?.focus();
      } else if (e.key === "/" && !isInput) {
        e.preventDefault();
        topInput?.focus();
      } else if (e.key === "Escape") {
        document.getElementById("searchDropdown")?.classList.remove("open");
        this.toggleMobileSidebar(false);
        document.getElementById("applePlayerBar")?.classList.remove("is-expanded");
        if (document.getElementById("movieDetailModal")?.classList.contains("open")) {
          this.closeMovieModal();
        }
      } else if (e.code === "Space" && !isInput) {
        e.preventDefault();
        this.toggleNowPlayingPlayPause();
      } else if ((e.key === "f" || e.key === "F") && !isInput) {
        const modal = document.getElementById("movieDetailModal");
        const videoEl = document.getElementById("hlsVideoElement");
        if (modal?.classList.contains("open") && videoEl) {
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen?.();
          } else {
            videoEl.requestFullscreen?.() || videoEl.webkitRequestFullscreen?.();
          }
        }
      } else if ((e.key === "m" || e.key === "M") && !isInput) {
        const videoEl = document.getElementById("hlsVideoElement");
        if (videoEl) {
          videoEl.muted = !videoEl.muted;
          this.showToast(videoEl.muted ? "🔇 Đã tắt tiếng (Muted)" : "🔊 Đã bật âm thanh");
        }
      }
    });

    // Dynamic Island / Mini Theater Hover Controller với Debounce chống giật viền (Anti-Glitch)
    const playerBar = document.getElementById("applePlayerBar");
    if (playerBar) {
      let collapseTimer = null;
      let expandTimer = null;

      playerBar.addEventListener("mouseenter", () => {
        if (collapseTimer) {
          clearTimeout(collapseTimer);
          collapseTimer = null;
        }
        expandTimer = setTimeout(() => {
          playerBar.classList.add("is-expanded");
        }, 50);
      });

      playerBar.addEventListener("mouseleave", () => {
        if (expandTimer) {
          clearTimeout(expandTimer);
          expandTimer = null;
        }
        // Debounce an toàn 220ms: Cho phép rê chuột sát mép viền cong mà không bao giờ bị glitch / nhấp nháy
        collapseTimer = setTimeout(() => {
          playerBar.classList.remove("is-expanded");
        }, 220);
      });

      // Chạm hoặc click để mở rộng / thu nhỏ (Hỗ trợ hoàn hảo cả Mobile, iPad & Desktop)
      playerBar.addEventListener("click", (e) => {
        if (e.target.closest("button") || e.target.closest(".mini-scrub-bar")) return;
        playerBar.classList.toggle("is-expanded");
      });
    }
  }

  /* ==========================================================================
     RESUME PLAYBACK ENGINE (XEM TIẾP TỤC NẾU THOÁT GIỮA CHỪNG)
     ========================================================================== */
  savePlaybackProgress(slug, epIndex, currentTime, duration) {
    if (!slug || !currentTime || !duration || isNaN(currentTime) || isNaN(duration)) return;
    const progressMap = this.loadStorage("ngwyren_playback_progress", {});
    const percentage = Math.min(100, Math.round((currentTime / duration) * 100));
    const key = `${slug}_${epIndex}`;
    progressMap[key] = {
      slug,
      epIndex,
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration),
      percentage,
      updatedAt: Date.now()
    };
    this.saveStorage("ngwyren_playback_progress", progressMap);

    const histItem = this.watchHistory.find((h) => h.slug === slug);
    if (histItem) {
      histItem.progress = percentage;
      histItem.epIndex = epIndex;
      histItem.currentTime = Math.floor(currentTime);
      histItem.timestamp = Date.now();
      this.saveStorage("apple_cinema_history", this.watchHistory);
    }
  }

  getPlaybackProgress(slug, epIndex = 0) {
    if (!slug) return null;
    const progressMap = this.loadStorage("ngwyren_playback_progress", {});
    return progressMap[`${slug}_${epIndex}`] || null;
  }

  restartPlayback() {
    if (!this.selectedMovie) return;
    this.savePlaybackProgress(this.selectedMovie.slug, this.currentEpisodeIndex, 0, 100);
    const videoEl = document.getElementById("hlsVideoElement");
    if (videoEl) {
      videoEl.currentTime = 0;
      videoEl.play().catch(() => {});
      this.showToast(`⏪ Đang phát lại từ đầu (00:00)`);
    } else {
      this.startVideoPlayback(this.selectedMovie, this.currentEpisodeIndex, "hls-1");
    }
  }

  /* ==========================================================================
     USER AUTH, PROFILE & CLOUD DATABASE SYNC ENGINE (GOOGLE + GUEST + MULTI-DEVICE)
     ========================================================================== */
  initUserProfile() {
    this.userProfile = this.loadStorage("ngwyren_user_profile", {
      type: "guest",
      name: "Guest",
      handle: "@guest",
      avatar: "🎬",
      avatarType: "emoji",
      avatarUrl: ""
    });

    // Nếu còn lưu tên cũ "Ngwyren Cinema" hoặc "Khách" -> chuẩn hóa thành "Guest"
    if (this.userProfile.type === "guest" && (this.userProfile.name === "Ngwyren Cinema" || this.userProfile.name === "Khách" || this.userProfile.handle === "@ngwyren")) {
      this.userProfile.name = "Guest";
      this.userProfile.handle = "@guest";
      this.userProfile.avatar = "🎬";
      this.saveStorage("ngwyren_user_profile", this.userProfile);
    }

    this.selectedGuestAvatar = this.userProfile.avatar || "🎬";
    this.customUploadedAvatar = this.userProfile.avatarType === "image" ? this.userProfile.avatarUrl : null;
    
    // Đọc Google Client ID chính thức từ Google Cloud Console (Project Ngwyren Cinema)
    const configClientId = window.NGWYREN_AUTH_CONFIG?.googleClientId || "254225466849-jf2edaghogh3nlcb341j02thvd39m9bt.apps.googleusercontent.com";
    this.googleClientId = configClientId;
    this.saveStorage("ngwyren_google_client_id", configClientId);
    
    this.initCloudSync();
    this.initGoogleIdentity();
    this.updateProfileUI();
  }

  /* ==========================================================================
     CLOUD DATABASE SYNC ENGINE (LƯU TRỮ ĐÁM MÂY XUYÊN THIẾT BỊ)
     ========================================================================== */
  initCloudSync() {
    this.cloudSyncKey = this.loadStorage("ngwyren_cloud_key", "");
    if (!this.cloudSyncKey) {
      this.cloudSyncKey = "NGW-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      this.saveStorage("ngwyren_cloud_key", this.cloudSyncKey);
    }
    this.cloudObjId = this.loadStorage("ngwyren_cloud_obj_id", "");
    this.cloudEndpoint = window.NGWYREN_AUTH_CONFIG?.cloudStorageEndpoint || "https://api.restful-api.dev/objects";
    this.cloudSyncDebounce = null;
    this.cloudSyncing = false;
    this.lastCloudSyncTime = this.loadStorage("ngwyren_last_cloud_sync", 0);

    // Tự động kéo dữ liệu nền nhẹ sau khi mở web nếu đã có cloudObjId
    if (this.cloudObjId) {
      setTimeout(() => this.syncFromCloud(this.cloudObjId, false), 3500);
    }
  }

  triggerCloudSync(debounceMs = 2000) {
    if (this.cloudSyncDebounce) clearTimeout(this.cloudSyncDebounce);
    this.cloudSyncDebounce = setTimeout(() => {
      this.syncToCloud(false);
    }, debounceMs);
  }

  async syncToCloud(notify = false) {
    if (this.cloudSyncing) return;
    this.cloudSyncing = true;
    this.renderCloudSyncBadge(true);

    try {
      const payload = {
        name: `NGWYREN_CLOUD_${this.cloudSyncKey}`,
        data: {
          app: "ngwyren-cinema",
          cloudKey: this.cloudSyncKey,
          updatedAt: Date.now(),
          profile: this.userProfile,
          myList: this.myList || [],
          history: this.watchHistory || [],
          progress: this.playbackProgress || {}
        }
      };

      let resp;
      if (this.cloudObjId) {
        resp = await fetch(`${this.cloudEndpoint}/${this.cloudObjId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!resp.ok && resp.status === 404) {
          this.cloudObjId = "";
        }
      }

      if (!this.cloudObjId) {
        resp = await fetch(this.cloudEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (resp && resp.ok) {
          const json = await resp.json();
          if (json && json.id) {
            this.cloudObjId = json.id;
            this.saveStorage("ngwyren_cloud_obj_id", this.cloudObjId);
          }
        }
      }

      this.lastCloudSyncTime = Date.now();
      this.saveStorage("ngwyren_last_cloud_sync", this.lastCloudSyncTime);
    } catch (e) {
      console.warn("Cloud sync error:", e);
    } finally {
      this.cloudSyncing = false;
      this.renderCloudSyncBadge(false);
    }
  }

  async syncFromCloud(targetIdOrKey, notify = true) {
    if (!targetIdOrKey) return;
    const cleanId = String(targetIdOrKey).trim();
    if (!cleanId) return;

    if (notify) this.showToast("🔄 Đang nạp dữ liệu từ máy chủ Đám Mây...");

    try {
      const url = `${this.cloudEndpoint}/${cleanId}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error("Không tìm thấy dữ liệu trên Cloud với mã này");
      }
      const data = await resp.json();
      const cloudData = data?.data;

      if (!cloudData || cloudData.app !== "ngwyren-cinema") {
        throw new Error("Mã đồng bộ không hợp lệ");
      }

      // Merge Cloud state
      if (cloudData.profile) {
        this.userProfile = cloudData.profile;
        this.saveStorage("ngwyren_user_profile", this.userProfile);
        this.updateProfileUI();
      }
      if (Array.isArray(cloudData.myList)) {
        this.myList = Array.from(new Set([...(this.myList || []), ...cloudData.myList]));
        this.saveStorage("apple_cinema_mylist", this.myList);
      }
      if (Array.isArray(cloudData.history)) {
        this.watchHistory = Array.from(new Set([...(this.watchHistory || []), ...cloudData.history]));
        this.saveStorage("apple_cinema_history", this.watchHistory);
      }
      if (cloudData.progress && typeof cloudData.progress === "object") {
        this.playbackProgress = { ...(this.playbackProgress || {}), ...cloudData.progress };
        this.saveStorage("ngwyren_playback_progress", this.playbackProgress);
      }

      this.cloudObjId = cleanId;
      this.saveStorage("ngwyren_cloud_obj_id", cleanId);
      if (cloudData.cloudKey) {
        this.cloudSyncKey = cloudData.cloudKey;
        this.saveStorage("ngwyren_cloud_key", this.cloudSyncKey);
      }

      this.lastCloudSyncTime = Date.now();
      this.saveStorage("ngwyren_last_cloud_sync", this.lastCloudSyncTime);

      if (notify) {
        this.showToast(`🎉 Đồng bộ thành công từ Đám Mây! Đã nạp ${this.myList.length} phim đã lưu & tiến độ xem.`);
      }

      if (this.currentNav === "yeu-thich" || this.currentNav === "lich-su") {
        this.renderMainView();
      }
      this.renderCloudSyncBadge(false);
    } catch (e) {
      console.warn("Sync from cloud failed:", e);
      if (notify) {
        this.showToast(`⚠️ Đồng bộ thất bại: ${e.message || "Kiểm tra lại mã ID"}`);
      }
    }
  }

  renderCloudSyncBadge(isSyncing = false) {
    const badgeEl = document.getElementById("cloudSyncStatusBadge");
    const codeEl = document.getElementById("cloudSyncCodeDisplay");
    if (badgeEl) {
      if (isSyncing) {
        badgeEl.className = "cloud-status-badge syncing";
        badgeEl.innerHTML = `<i class="fas fa-rotate fa-spin"></i> Đang đồng bộ...`;
      } else {
        badgeEl.className = "cloud-status-badge";
        badgeEl.innerHTML = `<i class="fas fa-check-circle"></i> Đã kết nối`;
      }
    }
    if (codeEl) {
      codeEl.textContent = this.cloudObjId || this.cloudSyncKey;
    }
  }

  copyCloudKey() {
    const key = this.cloudObjId || this.cloudSyncKey;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(key).then(() => {
        this.showToast(`📋 Đã sao chép Mã Đám Mây: ${key}`);
      });
    } else {
      prompt("Sao chép Mã Đám Mây của bạn:", key);
    }
  }

  promptImportCloudData() {
    const code = prompt("Nhập Mã Đám Mây (Cloud ID) từ Điện thoại, iPad, hoặc máy tính khác của bạn:", "");
    if (code) {
      this.syncFromCloud(code.trim(), true);
    }
  }

  initGoogleIdentity() {
    if (window.google?.accounts?.id && this.googleClientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: this.googleClientId,
          callback: (response) => this.handleGoogleCredentialResponse(response),
          auto_select: false,
          cancel_on_tap_outside: true
        });

        const btnContainer = document.getElementById("googleButtonContainer");
        if (btnContainer) {
          btnContainer.innerHTML = "";
          window.google.accounts.id.renderButton(btnContainer, {
            theme: "filled_blue",
            size: "large",
            text: "continue_with",
            shape: "pill",
            width: 320
          });
          const customBtn = document.getElementById("btnCustomGoogleLogin");
          if (customBtn) customBtn.style.display = "none";
        }
      } catch (e) {
        console.warn("GIS Init error:", e);
      }
    }
  }

  handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;
    try {
      const base64Url = response.credential.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const payload = JSON.parse(jsonPayload);

      this.userProfile = {
        type: "google",
        name: payload.name || "Người dùng Google",
        handle: payload.email || "@google_user",
        avatar: "👤",
        avatarType: "image",
        avatarUrl: payload.picture || "",
        sub: payload.sub
      };
      this.saveStorage("ngwyren_user_profile", this.userProfile);
      this.updateProfileUI();
      this.syncToCloud(false);
      this.closeAuthModal();
      this.showToast(`🎉 Đăng nhập Google thành công! Chào mừng ${payload.name}`);
    } catch (e) {
      console.error("JWT Decode error:", e);
      this.showToast("⚠️ Không thể giải mã tài khoản Google.");
    }
  }

  updateProfileUI() {
    const nameEl = document.getElementById("topProfileName");
    const handleEl = document.getElementById("topProfileHandle");
    const avatarEl = document.getElementById("topProfileAvatar");

    const isGoogle = this.userProfile.type === "google";

    if (nameEl) {
      nameEl.textContent = isGoogle ? this.userProfile.name : "Guest";
    }
    if (handleEl) {
      if (isGoogle) {
        handleEl.textContent = this.userProfile.handle;
        handleEl.style.display = "block";
      } else {
        handleEl.textContent = "";
        handleEl.style.display = "none";
      }
    }
    if (avatarEl) {
      if (isGoogle && this.userProfile.avatarType === "image" && this.userProfile.avatarUrl) {
        avatarEl.innerHTML = `<img src="${this.userProfile.avatarUrl}" alt="Avatar" class="profile-avatar-img" />`;
      } else if (isGoogle) {
        avatarEl.innerHTML = `<div class="profile-avatar-letter">${(this.userProfile.name || "G").charAt(0).toUpperCase()}</div>`;
      } else {
        avatarEl.innerHTML = `<div class="profile-avatar-letter" style="background: rgba(255, 255, 255, 0.16); color: #ffffff;">G</div>`;
      }
    }
  }

  openAuthModal() {
    const modal = document.getElementById("authModal");
    const sheet = document.getElementById("authSheet");
    if (!modal || !sheet) return;

    const isGoogle = this.userProfile.type === "google";

    if (isGoogle) {
      // Đã đăng nhập Google -> Thẻ hồ sơ tinh gọn, nút Đăng xuất
      sheet.innerHTML = `
        <div class="auth-header simple">
          <h3><i class="fab fa-google" style="color: #4285f4;"></i> Tài Khoản Google</h3>
          <button class="modal-ctrl-btn icon-only" onclick="app.closeAuthModal()" aria-label="Đóng">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="auth-logged-card">
          <div class="auth-avatar-logged">
            ${
              this.userProfile.avatarType === "image" && this.userProfile.avatarUrl
                ? `<img src="${this.userProfile.avatarUrl}" alt="Avatar" />`
                : `<div class="avatar-letter">${(this.userProfile.name || "G").charAt(0).toUpperCase()}</div>`
            }
          </div>
          <div class="auth-logged-details">
            <div class="auth-logged-name">${this.userProfile.name}</div>
            <div class="auth-logged-email">${this.userProfile.handle}</div>
            <span class="auth-verified-badge"><i class="fas fa-check-circle"></i> Đang hoạt động</span>
          </div>
        </div>

        <button class="btn-google-signout" onclick="app.logoutProfile()">
          <i class="fas fa-arrow-right-from-bracket"></i> Đăng Xuất Tài Khoản
        </button>
      `;
    } else {
      // Chưa đăng nhập -> Chỉ hiện Đăng nhập Google chuẩn như web lớn
      sheet.innerHTML = `
        <div class="auth-header simple">
          <h3><i class="fab fa-google" style="color: #4285f4;"></i> Đăng Nhập</h3>
          <button class="modal-ctrl-btn icon-only" onclick="app.closeAuthModal()" aria-label="Đóng">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="auth-google-hero">
          <div class="auth-brand-badge">
            <span class="auth-brand-name">Guest</span>
          </div>
          <p class="auth-subtitle">Đăng nhập tài khoản Google để lưu phim yêu thích và xem tiếp trên mọi thiết bị.</p>
        </div>

        <!-- Vùng chứa nút Google chính thức nếu đã có Client ID -->
        <div id="googleButtonContainer" class="google-btn-wrapper"></div>

        <!-- Nút Đăng nhập Google trực quan -->
        <button class="btn-google-login-main" id="btnCustomGoogleLogin" onclick="app.loginWithGoogle()">
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Tiếp tục với Google</span>
        </button>

        ${
          !this.googleClientId
            ? `
          <div class="google-project-connect-card">
            <div class="google-project-header">
              <i class="fas fa-key"></i> Kết nối Project Google Cloud: <strong>Ngwyren Cinema</strong>
            </div>
            <div class="google-project-input-row">
              <input type="text" id="googleClientIdQuickInput" placeholder="Dán Client ID (xxx.apps.googleusercontent.com)" class="google-quick-input" />
              <button class="btn-quick-save-client" onclick="app.saveGoogleClientIdFromModal()">Kết Nối</button>
            </div>
            <a href="https://console.cloud.google.com/apis/credentials/oauthclient" target="_blank" rel="noopener noreferrer" class="link-open-gcloud">
              <i class="fas fa-external-link-alt"></i> Mở trang tạo Client ID của project Ngwyren Cinema
            </a>
          </div>

          <div class="google-quick-email-login">
            <span class="or-separator">hoặc</span>
            <button class="btn-text-email-toggle" onclick="app.toggleQuickGmailInput()">
              <i class="fas fa-envelope"></i> Đăng nhập nhanh bằng địa chỉ Gmail
            </button>
            <div class="quick-gmail-box" id="quickGmailBox" style="display:none;">
              <input type="email" id="quickGmailInput" placeholder="Nhập Gmail của bạn..." class="google-quick-input" />
              <button class="btn-quick-save-client" onclick="app.submitQuickGmail()">Vào Web</button>
            </div>
          </div>
        `
            : ""
        }

        <div class="auth-guest-notice">
          <span class="guest-dot"></span> Đang xem với tư cách Khách
        </div>
      `;

      if (this.googleClientId) {
        setTimeout(() => this.initGoogleIdentity(), 50);
      }
    }

    modal.classList.add("open");
    document.body.classList.add("modal-open");
  }

  saveGoogleClientIdFromModal() {
    const input = document.getElementById("googleClientIdQuickInput");
    const val = input ? input.value.trim() : "";
    if (!val) {
      this.showToast("⚠️ Vui lòng dán mã Google Client ID");
      return;
    }
    this.googleClientId = val;
    this.saveStorage("ngwyren_google_client_id", val);
    this.initGoogleIdentity();
    this.showToast("🔑 Đã kết nối Google Client ID thành công!");
    this.openAuthModal();
    setTimeout(() => this.loginWithGoogle(), 400);
  }

  toggleQuickGmailInput() {
    const box = document.getElementById("quickGmailBox");
    if (box) {
      box.style.display = box.style.display === "none" ? "flex" : "none";
      const input = document.getElementById("quickGmailInput");
      if (input && box.style.display !== "none") input.focus();
    }
  }

  submitQuickGmail() {
    const input = document.getElementById("quickGmailInput");
    const email = input ? input.value.trim() : "";
    if (!email || !email.includes("@")) {
      this.showToast("⚠️ Vui lòng nhập đúng định dạng Gmail (vd: tenban@gmail.com)");
      return;
    }
    const prefix = email.split("@")[0].replace(/[._-]/g, " ");
    const name = prefix.charAt(0).toUpperCase() + prefix.slice(1);

    this.userProfile = {
      type: "google",
      name: name,
      handle: email,
      avatar: "👤",
      avatarType: "emoji",
      avatarUrl: ""
    };
    this.saveStorage("ngwyren_user_profile", this.userProfile);
    this.updateProfileUI();
    this.syncToCloud(false);
    this.closeAuthModal();
    this.showToast(`🎉 Đăng nhập Google thành công! Chào mừng ${name}`);
  }

  loginWithGoogle() {
    if (this.googleClientId && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            this.showToast("💡 Vui lòng bấm vào nút Google trên màn hình");
          }
        });
        return;
      } catch (e) {
        console.warn("GIS Prompt error:", e);
      }
    }

    const input = document.getElementById("googleClientIdQuickInput");
    if (input) {
      input.focus();
      this.showToast("🔑 Vui lòng dán Google Client ID từ project 'Ngwyren Cinema'");
    } else {
      this.openAuthModal();
    }
  }

  logoutProfile() {
    this.userProfile = {
      type: "guest",
      name: "Guest",
      handle: "@guest",
      avatar: "🎬",
      avatarType: "emoji",
      avatarUrl: ""
    };
    this.saveStorage("ngwyren_user_profile", this.userProfile);
    this.updateProfileUI();
    this.syncToCloud(false);
    this.closeAuthModal();
    this.showToast(`👋 Đã trở về chế độ Guest`);
  }

  closeAuthModal() {
    const modal = document.getElementById("authModal");
    if (!modal) return;
    modal.classList.remove("open");
    if (!document.getElementById("movieDetailModal")?.classList.contains("open")) {
      document.body.classList.remove("modal-open");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new AppleCinemaApp();
  window.app.init();
});
