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
    this.initGlobalAdBlocker();
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

    // Bộ lọc chuẩn 16:9 widescreen HD cho ảnh banner Hero Showcase (loại bỏ ảnh poster dọc, ảnh mờ)
    const isWidescreenHd = (m) => {
      if (!m || !m.backdrop || !m.poster) return false;
      const b = m.backdrop;
      if (b === m.poster) return false;
      if (b.includes("animevsub") || b.includes("animevietsub")) return false;
      if (b.includes("data/poster") || b.includes("-poster.") || b.includes("/poster/")) return false;
      if (b.endsWith("-poster.webp") || b.endsWith("-poster.jpg")) return false;
      if (b.includes("nguonc.com")) return false;
      return true;
    };

    // Lọc các phim bom tấn có ảnh nền nét từ ứng viên và catalog
    const seedMovies = candidateSlugs
      .map((s) => this.service.slugMap.get(s))
      .filter((m) => isWidescreenHd(m));

    const catalogHdMovies = this.service.movies
      .filter((m) => isWidescreenHd(m) && (m.rating >= 8.0 || m.year >= 2024))
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
      "lich-chieu": 3,
      "cai-dat": 4
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

  /* ==========================================================================
     CONTINUE WATCHING HOME SHELF (HÀNG "TIẾP TỤC XEM" CHUẨN APPLE TV & NETFLIX)
     ========================================================================== */
  renderContinueWatchingShelfHTML() {
    const continueItems = this.watchHistory
      .map((h) => ({
        movie: this.findMovie(h.slug),
        epIndex: h.epIndex || 0,
        progress: h.progress || 0,
        currentTime: h.currentTime || 0
      }))
      .filter((x) => x.movie && x.progress > 0 && x.progress < 95);

    if (continueItems.length === 0) return "";

    return `
      <section class="vision-shelf-section vision-continue-watching-shelf">
        <div class="vision-shelf-header">
          <h2 class="vision-shelf-title"><i class="fas fa-clock-rotate-left" style="margin-right: 8px;"></i>Tiếp Tục Xem</h2>
          <button class="vision-see-all-pill" onclick="app.setNavigation('lich-su')">Xem Tất Cả (${continueItems.length})</button>
        </div>
        <div class="vision-continue-shelf-grid">
          ${continueItems.slice(0, 4).map(({ movie, epIndex, progress, currentTime }) => {
            const ep = movie.episodes?.[epIndex] || movie.episodes?.[0];
            const epLabel = ep?.name ? this.formatEpisodeLabel(ep.name, `Tập ${epIndex + 1}`) : (movie.type === "series" ? `Tập ${epIndex + 1}` : "Bản Full");
            const timeStr = currentTime > 0 ? this.formatSeconds(currentTime) : "";
            return `
              <div class="continue-shelf-card" onclick="app.openMovieModal('${movie.slug}', true, ${epIndex})">
                <div class="continue-shelf-thumb">
                  <img src="${movie.backdrop || movie.poster}" alt="${movie.title}" loading="lazy" decoding="async" />
                  <div class="continue-shelf-play"><i class="fas fa-play"></i></div>
                  <div class="continue-shelf-badge">${epLabel}</div>
                  <div class="continue-shelf-bar">
                    <div class="continue-shelf-fill" style="width: ${progress}%;"></div>
                  </div>
                </div>
                <div class="continue-shelf-info">
                  <div class="continue-shelf-title">${movie.title}</div>
                  <div class="continue-shelf-meta">
                    <span>${timeStr ? `Đã xem ${timeStr}` : epLabel}</span>
                    <span>${progress}%</span>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </section>
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
                <div style="width: 100%;">
                  <strong style="font-size: 0.88rem; color: #ffffff;">Độ mờ kính</strong>
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
          </div>
        </div>
      </div>
    `;
  }

  renderScheduleViewHTML() {
    const schedule = window.NGWYREN_AIR_SCHEDULE || {};
    const dayKeys = ["thu-2", "thu-3", "thu-4", "thu-5", "thu-6", "thu-7", "chu-nhat"];
    const dayNames = {
      "thu-2": "Thứ 2",
      "thu-3": "Thứ 3",
      "thu-4": "Thứ 4",
      "thu-5": "Thứ 5",
      "thu-6": "Thứ 6",
      "thu-7": "Thứ 7",
      "chu-nhat": "Chủ Nhật"
    };

    // Xác định ngày hiện tại trong tuần (Hôm nay) và tính ngày/tháng thực tế cho 7 ngày trong tuần
    const now = new Date();
    const jsDay = now.getDay(); // 0: Chủ Nhật, 1: Thứ 2, 2: Thứ 3...
    const todayKey = jsDay === 0 ? "chu-nhat" : `thu-${jsDay + 1}`;

    const dayIndexInWeek = (jsDay + 6) % 7; // Thứ 2 = 0, ..., Chủ Nhật = 6
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayIndexInWeek);

    const dayDates = {};
    dayKeys.forEach((k, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const dayNum = String(d.getDate()).padStart(2, "0");
      const monthNum = String(d.getMonth() + 1).padStart(2, "0");
      dayDates[k] = `${dayNum}/${monthNum}`;
    });

    if (!this.activeScheduleDay) {
      this.activeScheduleDay = todayKey;
    }

    const currentDayKey = this.activeScheduleDay;
    const dayItems = schedule[currentDayKey] || [];

    const tabsHTML = dayKeys
      .map((k) => {
        const isToday = k === todayKey;
        const isActive = k === currentDayKey;
        const count = (schedule[k] || []).length;
        return `
          <button class="schedule-tab-btn ${isActive ? "active" : ""} ${isToday ? "is-today" : ""}"
                  onclick="app.selectScheduleDay('${k}')"
                  data-day="${k}">
            ${isToday ? '<span class="tab-today-badge-outer"><i class="fas fa-circle-dot"></i> Hôm nay</span>' : ""}
            <span class="tab-day-label">${dayNames[k]}</span>
            <span class="tab-date-label">${dayDates[k]}</span>
            <span class="tab-count-tag">${count} phim</span>
          </button>
        `;
      })
      .join("");

    const cardsHTML = dayItems.length > 0
      ? dayItems
          .map((m) => {
            const genresHTML = (m.genres || []).slice(0, 2).map((g) => `<span class="sch-genre-tag">${g}</span>`).join("");
            return `
              <article class="schedule-card-glass" onclick="app.openMovieModal('${m.slug}', true)">
                <div class="schedule-card-media">
                  <img src="${m.poster || m.backdrop}" alt="${m.title}" loading="lazy" decoding="async"
                       onerror="this.src='https://phimimg.com/upload/vod/20251229-1/d7f24b91fd95fb7cf353e1369e2318b7.jpg'" />
                  <div class="schedule-card-top-badges">
                    <span class="sch-time-pill"><i class="far fa-clock"></i> ${m.airTime || "10:00 Sáng"}</span>
                    <span class="sch-quality-pill"><i class="fas fa-sparkles"></i> ${m.quality || "1080"}</span>
                  </div>
                  <div class="schedule-hover-play">
                    <div class="sch-play-icon"><i class="fas fa-play"></i></div>
                  </div>
                </div>
                <div class="schedule-card-info">
                  <h3 class="schedule-movie-title" title="${m.title}">${m.title}</h3>
                  <div class="schedule-movie-sub">${m.originTitle || m.country}</div>
                  <div class="schedule-movie-chips">
                    <span class="sch-ep-pill"><i class="fas fa-tv"></i> ${this.formatEpisodeLabel(m.currentEpisode || "Tập Mới", "Tập Mới")}</span>
                  </div>
                  <div class="schedule-movie-genres">${genresHTML}</div>
                </div>
              </article>
            `;
          })
          .join("")
      : `
        <div class="schedule-empty-state">
          <i class="fas fa-calendar-xmark"></i>
          <h3>Chưa có lịch phát sóng cho ${dayNames[currentDayKey]}</h3>
          <p>Các tập phim hoạt hình 3D và Anime mới đang được tự động đồng bộ hàng ngày.</p>
        </div>
      `;

    return `
      <div class="vision-dashboard-grid">
        ${this.renderLeftSideColumnHTML(this.service.movies, "Đang Chiếu")}

        <div class="vision-main-col vision-col-transition">
          <!-- Spatial Schedule Hero Header -->
          <section class="schedule-hero-panel">
            <h1 class="schedule-hero-title">Lịch Chiếu Phim</h1>
          </section>

          <!-- Day of Week Capsule Scroller Bar -->
          <div class="schedule-tabs-bar">
            <div class="schedule-tabs-scroll-wrap">
              ${tabsHTML}
            </div>
          </div>

          <!-- Schedule Status Header Bar -->
          <div class="schedule-status-header">
            <div class="schedule-status-title">
              <span class="schedule-status-dot"></span>
              Phát sóng <strong>${dayNames[currentDayKey]}</strong>
              ${currentDayKey === todayKey ? '<span class="schedule-live-badge">HÔM NAY ĐANG CHIẾU</span>' : ""}
            </div>
            <div class="schedule-status-total">
              Đang phát sóng: <strong>${dayItems.length} bộ phim</strong>
            </div>
          </div>

          <!-- Schedule Cards 4-Column Grid -->
          <div class="schedule-cards-grid">
            ${cardsHTML}
          </div>
        </div>
      </div>
    `;
  }

  selectScheduleDay(dayKey) {
    this.activeScheduleDay = dayKey;
    this.triggerHaptic("light");
    this.renderMainView();
  }

  applyGlassDynamics(percent) {
    const p = Math.max(0, Math.min(100, Number(percent)));
    const t = p / 100;

    // 100% continuous linear interpolation (LERP) - no steps, no thresholds, zero glitch!
    const blurPx = Math.round(4 + t * 50); // 4px -> 54px
    const alpha = (0.15 + t * 0.77).toFixed(3); // 0.15 -> 0.92
    const panelAlpha = (0.025 + t * 0.11).toFixed(3); // 0.025 -> 0.135
    const dockAlpha = (0.22 + t * 0.72).toFixed(3); // 0.22 -> 0.94
    const borderAlpha = (0.42 - t * 0.26).toFixed(3); // 0.42 -> 0.16
    const rimAlpha = (0.65 - t * 0.45).toFixed(3); // 0.65 -> 0.20
    const shadowAlpha = (0.25 + t * 0.55).toFixed(3); // 0.25 -> 0.80
    const shadowBlur = Math.round(20 + t * 50); // 20px -> 70px

    const root = document.documentElement;
    root.style.setProperty("--glass-dyn-blur", `${blurPx}px`);
    root.style.setProperty("--glass-dyn-alpha", `${alpha}`);
    root.style.setProperty("--glass-panel-alpha", `${panelAlpha}`);
    root.style.setProperty("--glass-dock-alpha", `${dockAlpha}`);
    root.style.setProperty("--glass-border-alpha", `${borderAlpha}`);
    root.style.setProperty("--glass-rim-alpha", `${rimAlpha}`);
    root.style.setProperty("--glass-shadow-alpha", `${shadowAlpha}`);
    root.style.setProperty("--glass-shadow-blur", `${shadowBlur}px`);
    root.style.setProperty("--range-fill", `${p}%`);
  }

  initGlassSlider() {
    const range = document.getElementById("glassNativeRange");
    const label = document.getElementById("glassSliderValueLabel");
    if (!range) return;

    const applyPercent = (val, save = false) => {
      const percent = Math.max(0, Math.min(100, Number(val)));
      range.style.setProperty("--range-fill", `${percent}%`);

      // Cập nhật động học mượt mà liên tục từng 1% không hề có nấc gián đoạn
      this.applyGlassDynamics(percent);

      if (label) {
        const text = percent < 30 ? "Trong Suốt" : (percent > 70 ? "Kính Mờ" : "Tiêu Chuẩn");
        label.textContent = `${text} (${percent}%)`;
      }

      if (save) {
        this.settings.glassPercent = percent;
        this.settings.glassBlur = percent < 30 ? "clear" : (percent > 70 ? "frost" : "standard");
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

    this.applyGlassDynamics(percent);
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

    // Trang Lịch Chiếu Phim (Hoạt Hình 3D & Anime Showtimes)
    if (this.currentNav === "lich-chieu") {
      container.innerHTML = this.renderScheduleViewHTML();
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

            ${this.renderContinueWatchingShelfHTML()}

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
                     <h1 class="vision-hero-title">${title} (${list.length} phim)</h1>
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
        <img class="vision-hero-bg" src="${this.getMovieBackdrop(movie)}" alt="${movie.title}" fetchpriority="high" decoding="async" />
        <div class="vision-hero-overlay"></div>

        <div class="vision-hero-top">
          <div class="vision-hero-dots">
            ${this.heroMovies.map((_, i) => `
              <button class="vision-hero-dot ${i === this.heroIndex ? "active" : ""}" onclick="app.setHeroSlide(${i})" aria-label="Slide ${i + 1}"></button>
            `).join("")}
          </div>
        </div>

        <div class="vision-hero-bottom">
          <div class="vision-hero-info">
            <div class="vision-hero-genres">
              ${movie.genres.slice(0, 4).map((g) => `<span class="vision-genre-tag">${g}</span>`).join("")}
            </div>

            <h1 class="vision-hero-title">${movie.title}</h1>
            <p class="vision-hero-desc">${movie.synopsis}</p>

            <div class="vision-hero-actions">
              <button class="vision-btn-watch" onclick="app.openMovieModal('${movie.slug}', true)">
                <i class="fas fa-play"></i> Xem Ngay
              </button>
              <button class="vision-btn-outline" onclick="app.toggleMyList('${movie.slug}', event)">
                <i class="${inMyList ? "fas fa-star" : "far fa-star"}"></i>
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
        <img src="${this.getMovieBackdrop(movie)}" alt="${movie.title}" loading="lazy" decoding="async"
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
          <img class="vision-continue-thumb" src="${this.getMoviePoster(movie)}" alt="${movie.title}" loading="lazy" decoding="async" />
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
    const inMyList = this.isInMyList(movie);
    return `
      <article class="vision-feature-card" onclick="app.openMovieModal('${movie.slug}', false)">
        <img class="vision-feature-img" src="${this.getMoviePoster(movie)}" alt="${movie.title}" loading="lazy" decoding="async"
             onerror="this.src='https://phimmoiz.one/wp-content/uploads/2026/10/matchbox-phim-dien-anh-poster.webp'" />
        <div class="vision-feature-shade"></div>

        <button class="vision-card-more ${inMyList ? "active" : ""}"
                onclick="event.stopPropagation(); app.toggleMyList('${movie.slug}', event)"
                title="${inMyList ? "Đã lưu vào Yêu thích" : "Lưu vào Yêu thích"}">
          <i class="${inMyList ? "fas fa-star" : "far fa-star"}"></i>
        </button>

        <div class="vision-feature-bottom">
          <div class="vision-feature-meta">
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
    return "";
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
          <img class="chart-thumb" src="${m.poster}" alt="${m.title}" loading="lazy" decoding="async" />
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
    const is4k = Boolean(
      (movie.quality && movie.quality.toString().toUpperCase().includes("4K")) ||
      (Array.isArray(movie.sectionTags) && movie.sectionTags.includes("4k"))
    );
    const qualityBadge = is4k
      ? `<span class="ribbon-quality ribbon-4k"><i class="fas fa-sparkles"></i> 4K</span>`
      : `<span class="ribbon-quality ribbon-1080">1080p</span>`;
    const epText = movie.type === "series"
      ? (movie.episodeCurrent || "Tập mới")
      : (this.getMovieLanguageLabel(movie).split("+")[0].trim() || "Full");

    return `
      <article class="movie-card ${rankNum ? "ranked-card" : ""}"
               onclick="app.openMovieModal('${movie.slug}', false)">
        <div class="movie-poster-wrap">
          <img src="${this.getMoviePoster(movie)}" alt="${movie.title}" loading="lazy" decoding="async"
               onerror="this.src='https://phimmoiz.one/wp-content/uploads/2026/10/matchbox-phim-dien-anh-poster.webp'" />
          <div class="poster-badges-top">
            ${qualityBadge}
            <span class="ribbon-ep">${epText}</span>
          </div>
          ${rankNum ? `<span class="rank-number-badge">${rankNum}</span>` : ""}

          <div class="poster-hover-overlay">
            <div class="hover-play-center" onclick="event.stopPropagation(); app.openMovieModal('${movie.slug}', true)" title="Phát ngay">
              <i class="fas fa-play" style="margin-left: 2px;"></i>
            </div>
            <div class="hover-bottom-row">
              <span class="hover-match-score">${movie.matchScore || 96}% Phù hợp</span>
              <div class="hover-action-btns">
                <button class="mini-circle-btn ${inMyList ? "active" : ""}"
                        onclick="app.toggleMyList('${movie.slug}', event)"
                        title="${inMyList ? "Xóa khỏi Yêu thích" : "Lưu vào Yêu thích"}">
                  <i class="${inMyList ? "fas fa-star" : "far fa-star"}"></i>
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

    // Chuẩn bị sẵn đầy đủ các slot tập phim tức thì 0ms (không bao giờ để người dùng phải chờ tải)
    this.prepareMovieEpisodeSlots(movie);

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
      requestAnimationFrame(() => {
        sheet.classList.add("modal-movie-switch");
      });
    }

    const prevEpSource = movie.episodes?.[epIndex]?.source || "";

    if (shouldAutoPlay) {
      this.startVideoPlayback(movie, epIndex, defaultSrv);
    } else {
      this.isPlaying = false;
      this.setNowPlayingBar(movie, epIndex, false);
    }

    // Làm giàu dữ liệu nguồn phát ngầm (Background Enrich) từ API mà không chặn hiển thị tập phim 0ms
    const initialEp = movie.episodes?.[epIndex] || movie.episodes?.[0];
    const needsApiSync = !movie._isEnriched || !initialEp?.source || initialEp?.needsEnrich || (movie.type === "series" && movie.episodes?.length <= 1);

    if (needsApiSync) {
      this.service.enrichMovieStreams(movie, false).then((enriched) => {
        if (this.selectedMovie && this.selectedMovie.slug === enriched.slug) {
          const langText = document.getElementById("modalLanguageText");
          if (langText) langText.textContent = this.getMovieLanguageLabel(enriched);
          this.refreshEpisodesInModal(enriched);
          this.renderServerButtons(enriched, this.currentEpisodeIndex);
          const newEpSource = enriched.episodes?.[this.currentEpisodeIndex]?.source || "";
          const isPlayingNow = document.getElementById("activeVideoContainer")?.classList.contains("playing");
          if (isPlayingNow && newEpSource && newEpSource !== prevEpSource && this.currentServerMode === "hls-1") {
            this.startVideoPlayback(enriched, this.currentEpisodeIndex, "hls-1");
          } else {
            this.renderDynamicQualityButtons();
          }
        }
      });
    }
  }

  prepareMovieEpisodeSlots(movie) {
    if (!movie || movie.type !== "series") return;
    movie.episodes = movie.episodes || [];
    let expected = 0;
    if (typeof movie.episodeTotal === "number" && movie.episodeTotal > 0 && movie.episodeTotal <= 300) {
      expected = movie.episodeTotal;
    }
    const currentStr = String(movie.episodeCurrent || "");
    const match = currentStr.match(/(\d+)/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (parsed > expected && parsed <= 300) expected = parsed;
    }

    if (expected > movie.episodes.length) {
      const startIdx = movie.episodes.length + 1;
      for (let i = startIdx; i <= expected; i++) {
        movie.episodes.push({
          name: `Tập ${i}`,
          slug: `tap-${i}`,
          source: "",
          needsEnrich: true
        });
      }
    }
  }

  closeMovieModal() {
    const modalBackdrop = document.getElementById("movieDetailModal");
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove("open");
    modalBackdrop.classList.remove("lights-off");
    document.getElementById("movieDetailSheet")?.classList.remove("apple-theater-mode");
    if (this._appleControlsTimeout) {
      clearTimeout(this._appleControlsTimeout);
      this._appleControlsTimeout = null;
    }
    this.lightsOff = false;
    document.body.style.overflow = "";
    document.body.classList.remove("modal-open");
    this.stopModalVideo();
    this.isPlaying = false;
    if (this.playingMovie || this.selectedMovie) {
      this.setNowPlayingBar(this.playingMovie || this.selectedMovie, this.currentEpisodeIndex, false);
    }
  }

  minimizeToMiniPlayer() {
    if (this.selectedMovie) {
      this.setNowPlayingBar(this.selectedMovie, this.currentEpisodeIndex, true);
      this.showToast(`Đang thu nhỏ "${this.selectedMovie.title}" xuống thanh phát Ngwyren Cinema`);
    }
    this.closeMovieModal();
  }

  formatEpisodeLabel(name, fallback = "Tập 1") {
    if (!name) return fallback;
    const str = String(name).trim();
    if (/^tập$/i.test(str)) return "Tập 1";
    if (/^tập\s*mới$/i.test(str)) return "Tập Mới";
    if (/^hoàn$/i.test(str) || /^full$/i.test(str) || /^trọn\s*bộ$/i.test(str)) return "Trọn Bộ";
    const matchTapNum = str.match(/^tập\s*(\d+.*)$/i);
    if (matchTapNum) {
      return `Tập ${matchTapNum[1]}`;
    }
    const matchEpNum = str.match(/^ep(?:isode)?\s*(\d+.*)$/i);
    if (matchEpNum) {
      return `Tập ${matchEpNum[1]}`;
    }
    // Chuẩn hóa viết hoa chữ cái đầu tiên, không để nguyên khối viết hoa
    if (str === str.toUpperCase() && str.length > 2) {
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
    return str;
  }

  getPlayButtonHTML(movie, epIndex) {
    const savedProg = this.getPlaybackProgress(movie.slug, epIndex);
    if (savedProg && savedProg.currentTime > 10 && savedProg.percentage < 95) {
      return `<i class="fas fa-play"></i> Tiếp tục từ ${this.formatSeconds(savedProg.currentTime)} (${savedProg.percentage}%)`;
    }
    const currentEp = (movie.episodes && movie.episodes[epIndex]) || (movie.episodes && movie.episodes[0]);
    if (!currentEp || !currentEp.name) {
      return `<i class="fas fa-play"></i> Phát Ngay`;
    }
    const epLabel = this.formatEpisodeLabel(currentEp.name, "Tập 1");
    if (!epLabel || epLabel === "Tập" || epLabel === "TẬP") {
      return `<i class="fas fa-play"></i> Phát Ngay`;
    }
    return `<i class="fas fa-play"></i> Phát ${epLabel}`;
  }

  getMovieBackdrop(movie) {
    if (!movie) return "";
    let b = movie.backdrop || "";
    const isSuspicious = !b ||
      (movie.poster && b === movie.poster) ||
      b.includes("animevietsub") ||
      b.includes("animevsub") ||
      b.includes("data/poster") ||
      b.includes("-poster.") ||
      b.includes("/poster/") ||
      b.endsWith("-poster.webp") ||
      b.endsWith("-poster.jpg");

    if (!isSuspicious) {
      return b;
    }

    const match = this.service?.movies?.find(
      (m) => m && m.backdrop && m.backdrop !== m.poster &&
             !m.backdrop.includes("data/poster") && !m.backdrop.includes("-poster.") &&
             (m.slug === movie.slug || m.title === movie.title || m.originTitle === movie.originTitle ||
              (m.crawlSlug && movie.crawlSlug && m.crawlSlug === movie.crawlSlug))
    );
    if (match && match.backdrop) return match.backdrop;
    return b || movie.poster || "";
  }

  getMoviePoster(movie) {
    if (!movie) return "";
    let p = movie.poster || "";
    if (p && !p.includes("animevietsub") && !p.includes("animevsub")) {
      return p;
    }
    const match = this.service?.movies?.find(
      (m) => m && m.poster && !m.poster.includes("animevietsub") && !m.poster.includes("animevsub") &&
             (m.slug === movie.slug || m.title === movie.title || m.originTitle === movie.originTitle ||
              (m.crawlSlug && movie.crawlSlug && m.crawlSlug === movie.crawlSlug))
    );
    if (match && match.poster) return match.poster;
    return p || movie.backdrop || "";
  }

  getMovieLanguageLabel(movie) {
    if (!movie) return "Vietsub";
    const hasRealDub = Boolean(
      (movie.dubEpisodes && movie.dubEpisodes.length > 0) ||
      (movie.episodes && movie.episodes.some((ep) =>
        ep.altSources?.some((a) => {
          const lbl = (a.label || "").toLowerCase();
          return lbl.includes("thuyết minh") || lbl.includes("lồng tiếng") || lbl.includes("thuyet minh") || lbl.includes("long tieng") || lbl.includes("dub");
        })
      ))
    );
    if (hasRealDub) {
      const raw = (movie.language || "").toLowerCase();
      if (raw.includes("lồng tiếng")) {
        return raw.includes("vietsub") ? "Vietsub + Lồng Tiếng" : "Lồng Tiếng";
      }
      return raw.includes("vietsub") ? "Vietsub + Thuyết Minh" : "Thuyết Minh";
    }
    const raw = (movie.language || "").toLowerCase();
    if (raw === "lồng tiếng" && (!movie.episodes || movie.episodes.length === 0)) {
      return "Lồng Tiếng";
    }
    return "Vietsub";
  }

  renderModalContent(movie, isPlayingNow = false) {
    const sheet = document.getElementById("movieDetailSheet");
    if (!sheet) return;

    const inMyList = this.isInMyList(movie);
    const relatedItems = this.service.getRelatedMovies(movie, 9);
    const currentEp = movie.episodes[this.currentEpisodeIndex] || movie.episodes[0];
    const backdropUrl = this.getMovieBackdrop(movie);

    sheet.innerHTML = `
      <!-- Top Floating Modal Controls (Chỉ hiện icon chuẩn Apple Vision Pro) -->
      <div class="modal-top-controls">
        <button class="modal-ctrl-btn icon-only ${this.lightsOff ? "active" : ""}" id="lightsOffBtn" onclick="app.toggleLightsOff()" title="${this.lightsOff ? "Bật Đèn" : "Tắt Đèn Rạp"}" aria-label="Tắt Đèn Rạp">
          <i class="fas fa-lightbulb" id="lightsOffIcon"></i>
        </button>
        <button class="modal-ctrl-btn icon-only" onclick="app.minimizeToMiniPlayer()" title="Thu nhỏ xuống thanh Now Playing" aria-label="Thu Nhỏ">
          <i class="fas fa-compress-alt"></i>
        </button>
        <button class="modal-ctrl-btn icon-only" onclick="app.closeMovieModal()" title="Đóng" aria-label="Đóng">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- 16:9 Cinema Stage (Cover Preview + Active HLS/YouTube Player) -->
      <div class="modal-player-stage">
        <div class="player-cover-preview" id="modalCoverPreview"
             style="background-image: url('${backdropUrl}'); ${isPlayingNow ? "display:none;" : ""}">
          <div class="player-cover-content">
            <h2 style="font-size: clamp(1.6rem, 2.8vw, 2.5rem); font-weight: 800; line-height: 1.12; margin-bottom: 6px;">
              ${movie.title}
            </h2>
            <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 18px;">
              ${movie.originTitle} (${movie.year}) • ${movie.duration}
            </p>
            <div class="hero-actions">
              <button class="btn-primary-play" onclick="app.startVideoPlayback(app.selectedMovie, ${this.currentEpisodeIndex}, 'hls-1')">
                ${this.getPlayButtonHTML(movie, this.currentEpisodeIndex)}
              </button>
              ${
                movie.trailerUrl
                  ? `<button class="btn-glass-secondary" onclick="app.startVideoPlayback(app.selectedMovie, ${this.currentEpisodeIndex}, 'trailer')">
                      <i class="fab fa-youtube"></i> Xem Trailer
                    </button>`
                  : ""
              }
              <button class="btn-glass-secondary ${inMyList ? "active" : ""}" id="modalMyListBtn" onclick="app.toggleMyList('${movie.slug}', event)">
                <i class="${inMyList ? "fas fa-star" : "far fa-star"}"></i>
                <span>${inMyList ? "Đã Lưu Yêu Thích" : "Lưu Yêu Thích"}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Active Video Container (Apple Cinema Player - Không viền xanh, chuẩn Apple TV+) -->
        <div class="active-video-container ${isPlayingNow ? "playing" : ""}" id="activeVideoContainer" tabindex="-1">
          <!-- Video Element (đã bỏ controls mặc định của trình duyệt để triệt tiêu hoàn toàn viền xanh khi bấm phím cách) -->
          <video id="hlsVideoElement" class="${this.getQualityVideoClass(this.currentQuality)}" playsinline poster="${backdropUrl}" tabindex="-1"></video>
          <iframe id="trailerIframeElement" style="display: none;" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen tabindex="-1"></iframe>

          <!-- Apple Center HUD Pulse: Không vòng tròn, chỉ hiển thị icon -->
          <div class="apple-video-hud" id="appleVideoHud">
            <i class="fas fa-play" id="appleHudIcon"></i>
            <div class="apple-hud-text" id="appleHudText" style="display: none;"></div>
          </div>

          <!-- Apple Glass Player Overlay Controls (Giao diện điều khiển kính mờ chuẩn Apple visionOS / Apple TV+) -->
          <div class="apple-player-overlay" id="applePlayerOverlay">
            <!-- Click Layer phủ toàn màn hình để Play/Pause và Double click Toàn màn hình -->
            <div class="apple-player-click-layer" id="applePlayerClickLayer"
                 onclick="app.handleAppleVideoClick(event)"
                 ondblclick="app.toggleVideoFullscreen(event)"></div>

            <!-- Thanh đỉnh Apple: Chỉ hiển thị tên phim -->
            <div class="apple-player-topbar" id="applePlayerTopbar">
              <span class="apple-player-movie-name" title="${movie.title}">${movie.title}</span>
            </div>

            <!-- Thanh đáy Apple: Timeline Scrubber + Cụm điều khiển Kính mờ -->
            <div class="apple-player-bottombar" id="applePlayerBottombar">
              <!-- Apple Timeline Scrubber -->
              <div class="apple-scrub-container" id="appleScrubContainer"
                   onmousedown="app.startScrubbing(event)"
                   onmousemove="app.previewScrubTime(event)"
                   onmouseleave="app.hideScrubTimePreview()">
                <div class="apple-scrub-track">
                  <div class="apple-scrub-buffer" id="appleScrubBuffer"></div>
                  <div class="apple-scrub-fill" id="appleScrubFill"></div>
                  <div class="apple-scrub-thumb" id="appleScrubThumb"></div>
                </div>
                <div class="apple-scrub-tooltip" id="appleScrubTooltip">00:00</div>
              </div>

              <!-- Hàng phím điều khiển Apple -->
              <div class="apple-controls-row">
                <div class="apple-ctrls-left">
                  <!-- Play / Pause Button -->
                  <button class="apple-ctrl-btn apple-play-btn" id="applePlayBtn" onclick="app.toggleVideoPlayPause(event)" title="Phát / Dừng (Phím cách)">
                    <i class="fas fa-play" id="applePlayIcon"></i>
                  </button>

                  <!-- Tua lùi 5 giây -->
                  <button class="apple-ctrl-btn apple-skip-btn" onclick="app.seekRelative(-5, true, event)" title="Tua lùi 5 giây (←)">
                    <i class="fas fa-rotate-left"></i>
                  </button>

                  <!-- Tua tới 5 giây -->
                  <button class="apple-ctrl-btn apple-skip-btn" onclick="app.seekRelative(5, true, event)" title="Tua tới 5 giây (→)">
                    <i class="fas fa-rotate-right"></i>
                  </button>

                  <!-- Điều chỉnh âm lượng dạng trượt Apple -->
                  <div class="apple-volume-cluster" id="appleVolumeCluster">
                    <button class="apple-ctrl-btn" id="appleVolBtn" onclick="app.toggleVideoMute(event)" title="Bật / Tắt âm thanh (M)">
                      <i class="fas fa-volume-high" id="appleVolIcon"></i>
                    </button>
                    <div class="apple-vol-slider-wrap">
                      <input type="range" class="apple-vol-slider" id="appleVolSlider" min="0" max="1" step="0.05" value="1"
                             oninput="app.setVideoVolume(this.value)" />
                    </div>
                  </div>

                  <!-- Đồng hồ thời gian chuẩn Apple TV+ -->
                  <div class="apple-time-box">
                    <span id="appleCurrentTime">00:00</span>
                    <span class="apple-time-divider">/</span>
                    <span id="appleDurationTime">00:00</span>
                  </div>
                </div>

                <div class="apple-ctrls-right">
                  <!-- Tốc độ phát -->
                  <button class="apple-ctrl-btn apple-speed-btn" id="appleSpeedBtn" onclick="app.cyclePlaybackSpeed(event)" title="Tốc độ phát">
                    <span id="appleSpeedText">1.0x</span>
                  </button>

                  <!-- Picture in Picture -->
                  <button class="apple-ctrl-btn" onclick="app.toggleVideoPip(event)" title="Hình trong hình (PiP)">
                    <i class="fas fa-clone"></i>
                  </button>

                  <!-- Toàn màn hình -->
                  <button class="apple-ctrl-btn apple-fs-btn" id="appleFsBtn" onclick="app.toggleVideoFullscreen(event)" title="Toàn màn hình (F)">
                    <i class="fas fa-expand" id="appleFsIcon"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Server & Stream Switcher Toolbar (Multi-Source Server 1 / Server 2 & 4K/2K Quality Switcher) -->
      <div class="player-toolbar" id="playerToolbarContainer">
        <div class="player-toolbar-left" id="playerToolbarServers">
          ${this.buildServerButtonsHTML(movie, this.currentEpisodeIndex)}
        </div>

        <div class="player-toolbar-right">
          <div class="resume-toolbar-wrapper" id="resumeToolbarContainer">
            ${this.buildResumeButtonsHTML(movie, this.currentEpisodeIndex)}
          </div>
          <span class="server-label"><i class="fas fa-sliders"></i> Chất lượng luồng:</span>
          <div class="quality-selector-group" id="qualitySelectorGroup" role="group" aria-label="Chọn độ phân giải thực tế">
            ${this.buildQualityButtonsHTML(movie)}
          </div>
        </div>
      </div>

      <!-- Modal Metadata & Netflix-style Related / Episodes Content -->
      <div class="modal-body-content">
        <div class="modal-info-grid">
          <div>
            <div class="hero-meta-pills" style="margin-bottom: 10px;">
              <span class="meta-pill match">${movie.matchScore || 97}% Phù hợp với bạn</span>
              <span class="meta-pill">${movie.year}</span>
              <span class="meta-pill"><i class="fas fa-star"></i> ${movie.rating || 9.2}</span>
              <span class="meta-pill ${movie.quality === "4K" ? "badge-4k" : "badge-1080"}">${movie.quality === "4K" ? "<i class='fas fa-sparkles'></i> 4K Ultra HD" : "Full HD 1080p"}</span>
              <span class="meta-pill" id="modalLanguagePill"><i class="fas fa-volume-up"></i> <span id="modalLanguageText">${this.getMovieLanguageLabel(movie)}</span></span>
            </div>
            ${
              (() => {
                const syn = (movie.synopsis || "").trim();
                const isBoilerplate = syn.includes("được cập nhật liên tục tại Ngwyren Cinema") ||
                                      syn.includes("tác phẩm Anime hấp dẫn đang phát sóng");
                if (!syn || isBoilerplate) return "";
                return `<p class="modal-synopsis">${syn}</p>`;
              })()
            }
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
                    <img src="${rel.backdrop || rel.poster}" alt="${rel.title}" loading="lazy" decoding="async" />
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
                                title="${this.isInMyList(rel) ? "Xóa khỏi Yêu thích" : "Thêm vào Yêu thích"}">
                          <i class="${this.isInMyList(rel) ? "fas fa-star" : "far fa-star"}"></i>
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
        <span>${this.formatEpisodeLabel(ep.name, "Tập " + (idx + 1))}</span>
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
     HLS (.M3U8) AD-BLOCKER & MULTI-SERVER STREAMING ENGINE
     ========================================================================== */
  initGlobalAdBlocker() {
    if (window._adBlockerInitialized) return;
    window._adBlockerInitialized = true;
    const originalWindowOpen = window.open;
    window.open = function (url, target, features) {
      if (typeof url === "string") {
        const u = url.toLowerCase();
        const isAllowed = u.includes("youtube.com") || u.includes("google.com") || u.includes("github.com") || u.includes("accounts.google.com");
        if (!isAllowed) {
          console.warn("[AdBlocker] Đã chặn popup quảng cáo nhảy trang:", url);
          return null;
        }
      }
      return originalWindowOpen.call(window, url, target, features);
    };

    // Chặn triệt để các mã script quảng cáo, nhà cái cá cược chèn ngầm vào DOM
    const adPatterns = ["i999", "cwin", "nohu", "kubet", "thabet", "baccarat", "popads", "propellerads", "adsterra", "exoclick", "adtrue"];
    const originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function (child) {
      if (child && (child.tagName === "SCRIPT" || child.tagName === "IFRAME")) {
        const src = (child.src || "").toLowerCase();
        if (adPatterns.some((pattern) => src.includes(pattern))) {
          console.warn("[AdBlocker] Đã chặn phần tử quảng cáo chèn ngầm:", src);
          return child;
        }
      }
      return originalAppendChild.apply(this, arguments);
    };
  }

  cleanHlsAdSegments(playlistText) {
    if (!playlistText || typeof playlistText !== "string" || !playlistText.includes("#EXTM3U")) {
      return playlistText;
    }
    const lines = playlistText.split(/\r?\n/);
    const cleanLines = [];

    const isAdSegment = (uri) => {
      if (!uri || typeof uri !== "string") return false;
      const u = uri.trim().toLowerCase();
      if (u.includes("convertv") || u.includes("/v7/") || u.includes("segment_00")) return true;
      if (/\/v\d+\/[a-f0-9]{20,}\//.test(u)) return true;
      if (/segment_\d{3,}\.ts/.test(u)) return true;
      if (u.includes("9922") || u.includes("i999") || u.includes("casinopromo") || u.includes("quangcao_")) return true;
      return false;
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith("#EXTINF:")) {
        const nextLine = (i + 1 < lines.length) ? lines[i + 1] : "";
        if (isAdSegment(nextLine)) {
          // Bỏ qua thẻ #EXTINF và phân đoạn video quảng cáo nhà cái chèn vào
          i += 2;
          continue;
        }
      } else if (isAdSegment(line)) {
        i += 1;
        continue;
      } else if (line.startsWith("#EXT-X-KEY:METHOD=NONE")) {
        if (i + 2 < lines.length && isAdSegment(lines[i + 2])) {
          i += 1;
          continue;
        }
      }
      cleanLines.push(line);
      i += 1;
    }

    // Làm sạch các thẻ DISCONTINUITY liên tiếp hoặc dư thừa sau khi bóc tách quảng cáo
    const result = [];
    for (let j = 0; j < cleanLines.length; j++) {
      const cur = cleanLines[j];
      if (cur === "#EXT-X-DISCONTINUITY" && result.length > 0 && result[result.length - 1] === "#EXT-X-DISCONTINUITY") {
        continue;
      }
      result.push(cur);
    }
    return result.join("\n");
  }

  createAdFreePlaylistLoader() {
    const self = this;
    if (!window.Hls || !window.Hls.DefaultConfig || !window.Hls.DefaultConfig.loader) return undefined;
    return class extends window.Hls.DefaultConfig.loader {
      constructor(config) {
        super(config);
        const origLoad = this.load.bind(this);
        this.load = (context, cfg, callbacks) => {
          const origSuccess = callbacks.onSuccess;
          callbacks.onSuccess = (response, stats, ctx, networkDetails) => {
            if (response && typeof response.data === "string" && response.data.includes("#EXTM3U")) {
              response.data = self.cleanHlsAdSegments(response.data);
            }
            if (origSuccess) origSuccess(response, stats, ctx, networkDetails);
          };
          origLoad(context, cfg, callbacks);
        };
      }
    };
  }

  renderServerButtons(movie, epIndex = 0) {
    const el = document.getElementById("playerToolbarServers");
    const toolbar = document.getElementById("playerToolbarContainer");
    if (el) {
      el.innerHTML = this.buildServerButtonsHTML(movie, epIndex);
    }
    if (toolbar) {
      toolbar.classList.remove("has-server-rack");
    }
  }

  buildServerButtonsHTML(movie, epIndex = 0) {
    if (!movie) return "";
    const ep = movie.episodes?.[epIndex] || movie.episodes?.[0];
    const hasEmbed2 = Boolean(movie.nguoncEpisodes && movie.nguoncEpisodes.length > 0) || Boolean(ep?.embed);
    const hasDub = Boolean(movie.dubEpisodes && movie.dubEpisodes.length > 0);

    return `
      <span class="server-label"><i class="fas fa-server"></i> Nguồn phát:</span>
      <button class="server-btn ${this.currentServerMode === "hls-1" || !this.currentServerMode || this.currentServerMode.startsWith("alt-") ? "active" : ""}" id="srvBtnHls1"
              onclick="app.startVideoPlayback(app.selectedMovie, app.currentEpisodeIndex, 'hls-1')" title="Phát Server 1 chất lượng tốt nhất">
        <i class="fas fa-server"></i> Server 1
      </button>
      ${
        hasEmbed2
          ? `<button class="server-btn ${this.currentServerMode === "embed-1" ? "active" : ""}" id="srvBtnEmbed1"
                    onclick="app.startVideoPlayback(app.selectedMovie, app.currentEpisodeIndex, 'embed-1')" title="Phát Server 2">
              <i class="fas fa-server"></i> Server 2
            </button>`
          : ""
      }
      ${
        hasDub
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
    `;
  }

  async refreshMovieApiSources() {
    if (!this.selectedMovie) return;
    this.showAppleVideoHud("forward", "Đang nạp API...");
    try {
      const enriched = await this.service.enrichMovieStreams(this.selectedMovie, true);
      this.selectedMovie = enriched;
      const langText = document.getElementById("modalLanguageText");
      if (langText) langText.textContent = this.getMovieLanguageLabel(enriched);
      this.refreshEpisodesInModal(enriched);
      this.renderServerButtons(enriched, this.currentEpisodeIndex);
      this.renderDynamicQualityButtons();
      this.startVideoPlayback(enriched, this.currentEpisodeIndex, this.currentServerMode || "hls-1");
      this.showAppleVideoHud("forward", "Nạp API: 1080p");
    } catch (err) {
      console.warn("Lỗi nạp lại nguồn API:", err);
    }
  }

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

    // Nếu tập phim chưa có luồng thật hoặc link cũ/lỗi, tự động nạp luồng thật 1080p/4K từ API trước khi phát
    const initialEp = movie.episodes?.[epIndex] || movie.episodes?.[0];
    const isBrokenOrOld = !initialEp?.source || initialEp?.needsEnrich || initialEp.source.includes("opstream");
    if (!movie._isEnriched || isBrokenOrOld || (!initialEp?.source && !initialEp?.embed)) {
      await this.service.enrichMovieStreams(movie, isBrokenOrOld);
      const langText = document.getElementById("modalLanguageText");
      if (langText) langText.textContent = this.getMovieLanguageLabel(movie);
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

    // Cập nhật lại thanh Server Buttons và danh sách tập phim
    this.renderServerButtons(movie, epIndex);
    this.refreshEpisodesInModal(movie);

    const episode = movie.episodes[epIndex] || movie.episodes[0];
    const dubEp = movie.dubEpisodes?.[epIndex] || movie.dubEpisodes?.[0] || episode;
    const ncEp = movie.nguoncEpisodes?.[epIndex] || movie.nguoncEpisodes?.[0] || episode;

    // Chế độ phát Trailer YouTube
    if (serverMode === "trailer" && movie.trailerUrl) {
      this.destroyHls();
      document.getElementById("applePlayerOverlay")?.style.setProperty("display", "none");
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

    // 1. Xác định luồng phát HLS .m3u8 trực tiếp hoặc Embed Server
    let streamUrl = "";
    let selectedAltObj = null;

    if (serverMode && serverMode.startsWith("alt-")) {
      const altIdx = parseInt(serverMode.replace("alt-", ""), 10);
      selectedAltObj = episode?.altSources?.[altIdx];
      if (selectedAltObj) {
        streamUrl = selectedAltObj.source || selectedAltObj.embed || "";
      }
    } else if (serverMode === "dub-1") {
      streamUrl = (dubEp && dubEp.source) || (episode && episode.source) || "";
    } else if (serverMode === "embed-1" || serverMode === "nguonc-1") {
      streamUrl = (ncEp && ncEp.source) || (episode && episode.source) || "";
    } else {
      streamUrl = (episode && episode.source) || (ncEp && ncEp.source) || "";
    }

    // Kiểm tra URL bị cấm nhúng iframe vì X-Frame-Options: SAMEORIGIN (player.php, hhpanda.st, yanhh3d.ee, streamfree.vip)
    const isForbiddenIframe = (url) => {
      if (!url || typeof url !== "string") return false;
      return url.includes("player.php") || url.includes("hhpanda.st") || url.includes("yanhh3d.ee") || url.includes("streamfree.vip");
    };

    // Nếu streamUrl dính domain cấm nhúng, tự động tìm luồng m3u8 thật của phim
    if (isForbiddenIframe(streamUrl)) {
      const validEp = (episode?.source && !isForbiddenIframe(episode.source)) ? episode :
                      movie.episodes?.find((e) => e.source && !isForbiddenIframe(e.source));
      if (validEp) {
        streamUrl = validEp.source;
      } else {
        streamUrl = "";
      }
    }

    let isDirectM3u8 = Boolean(streamUrl && (streamUrl.includes(".m3u8") || streamUrl.includes("/hls/")));

    // Nếu phim có định dạng 4K thì ưu tiên phát 4K sắc nét nhất, ngược lại phát 1080
    const has4k = Boolean(
      (movie.quality && movie.quality.toString().toUpperCase().includes("4K")) ||
      (Array.isArray(movie.sectionTags) && movie.sectionTags.includes("4k"))
    );
    this.currentQuality = has4k ? "4K" : "1080";

    // Nếu không có luồng m3u8 trực tiếp, thử tìm luồng m3u8 trong altSources hoặc enrich
    if (!isDirectM3u8) {
      const altM3u8 = episode?.altSources?.find((a) => a.source && a.source.includes(".m3u8"))?.source;
      if (altM3u8) {
        streamUrl = altM3u8;
        isDirectM3u8 = true;
      }
    }

    // Nếu vẫn không có luồng m3u8 trực tiếp, sử dụng iframe với Sandbox an toàn
    if (!isDirectM3u8) {
      let fallbackEmbed =
        selectedAltObj ? (selectedAltObj.embed || selectedAltObj.source) :
        (streamUrl && (streamUrl.includes("http") || streamUrl.includes("//")))
          ? streamUrl
          : serverMode === "embed-1"
          ? ncEp?.embed || episode?.embed
          : serverMode === "dub-1"
          ? dubEp?.embed || episode?.embed
          : episode?.embed || ncEp?.embed;

      // Tuyệt đối không nhúng các link dính X-Frame-Options SAMEORIGIN vào iframe
      if (fallbackEmbed && isForbiddenIframe(fallbackEmbed)) {
        fallbackEmbed = "";
      }

      if (fallbackEmbed && iframeEl) {
        this.destroyHls();
        document.getElementById("applePlayerOverlay")?.style.setProperty("display", "none");
        if (videoEl) {
          videoEl.pause();
          videoEl.style.display = "none";
        }
        iframeEl.src = fallbackEmbed;
        iframeEl.style.display = "block";
        this.renderDynamicQualityButtons();
        this.renderServerButtons(movie, epIndex);
        return;
      }
    }

    // Chế độ phát HLS (.m3u8) trực tiếp của đúng bộ phim đang chọn (Tuyệt đối không dùng stream của phim khác)
    if (iframeEl) {
      iframeEl.src = "";
      iframeEl.style.display = "none";
    }
    if (!videoEl) return;
    videoEl.style.display = "block";
    document.getElementById("applePlayerOverlay")?.style.setProperty("display", "flex");
    this.initAppleVideoPlayerEvents();

    this.destroyHls();
    this.detectedHlsLevels = [];
    this.detectedAdRanges = [];
    this.actualVideoRes = { width: 0, height: 0, bitrateMbps: 0 };

    if (window.Hls && window.Hls.isSupported()) {
      const CustomPlaylistLoader = this.createAdFreePlaylistLoader();
      this.hlsInstance = new window.Hls({
        pLoader: CustomPlaylistLoader,
        enableWorker: true,
        lowLatencyMode: false,
        progressive: true,
        backBufferLength: 60,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 120 * 1000 * 1000,
        maxBufferHole: 0.5,
        startLevel: -1,
        capLevelToPlayerSize: false,
        abrEwmaDefaultEstimate: 50000000,
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.7
      });
      this.hlsInstance.loadSource(streamUrl);
      this.hlsInstance.attachMedia(videoEl);

      this.hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, (_, data) => {
        const levels = this.hlsInstance.levels || [];
        if (levels.length > 0) {
          // Khóa ngay vào mức phân giải và bitrate cao nhất (1080p / 4K)
          let highestIdx = levels.length - 1;
          let maxMetric = 0;
          levels.forEach((lvl, idx) => {
            const metric = (lvl.width || 0) * (lvl.height || 0) * (lvl.bitrate || 1);
            if (metric > maxMetric) {
              maxMetric = metric;
              highestIdx = idx;
            }
          });
          this.hlsInstance.currentLevel = highestIdx;
          this.hlsInstance.loadLevel = highestIdx;
          this.hlsInstance.nextLevel = highestIdx;
        }
        this.inspectHlsLevels(levels);
        this.applyHlsQualityLevel();
        this.renderDynamicQualityButtons();
        this.renderDynamicResumeButtons();
        this.applyVideoQualityVisuals();
        videoEl.play().catch(() => {});
        // Tự động tua tiếp đến đoạn đã xem dở và hiển thị banner kính mờ Apple visionOS
        const savedProg = this.getPlaybackProgress(movie.slug, epIndex);
        if (savedProg && savedProg.currentTime > 5 && savedProg.percentage < 95) {
          const applySavedTime = () => {
            if (savedProg && savedProg.currentTime > 5 && savedProg.percentage < 95) {
              if (Math.abs(videoEl.currentTime - savedProg.currentTime) > 2) {
                videoEl.currentTime = savedProg.currentTime;
              }
            }
          };
          videoEl.addEventListener("loadedmetadata", applySavedTime, { once: true });
          videoEl.addEventListener("canplay", applySavedTime, { once: true });
          applySavedTime();
          this.showResumeFloatingBanner(savedProg);
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
      this.hlsInstance.on(window.Hls.Events.ERROR, async (_, data) => {
        if (data.fatal) {
          console.warn("[HLS] Lỗi đường truyền video:", data.type, data.details);
          if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
            this.hlsInstance.startLoad();
            return;
          }
          if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
            this.hlsInstance.recoverMediaError();
            return;
          }

          // Tự động kết nối lại nguồn API mới nhất nếu link cũ bị gián đoạn hoặc 404
          if (!this._isAutoRetryingApi) {
            this._isAutoRetryingApi = true;
            try {
              const fresh = await this.service.enrichMovieStreams(movie, true);
              this._isAutoRetryingApi = false;
              if (fresh && fresh.episodes?.[epIndex]?.source && fresh.episodes[epIndex].source !== streamUrl) {
                this.startVideoPlayback(fresh, epIndex, serverMode);
                return;
              }
            } catch (e) {
              this._isAutoRetryingApi = false;
            }
          }

          // Fallback sang Embed nếu mọi luồng HLS trực tiếp không khả dụng
          const fallback = episode?.embed || ncEp?.embed || dubEp?.embed;
          if (fallback) {
            this.destroyHls();
            videoEl.style.display = "none";
            if (iframeEl) {
              iframeEl.src = fallback;
              iframeEl.style.display = "block";
            }
          }
        }
      });
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = streamUrl;
      // Khử quảng cáo video chèn trong luồng m3u8 cho Safari
      fetch(streamUrl).then(r => r.text()).then(txt => {
        if (txt && txt.includes("#EXTM3U") && (txt.includes("convertv") || txt.includes("/v7/") || txt.includes("segment_00") || txt.includes("9922"))) {
          const cleanTxt = this.cleanHlsAdSegments(txt);
          const base = streamUrl.substring(0, streamUrl.lastIndexOf("/") + 1);
          const absoluteTxt = cleanTxt.split(/\r?\n/).map(line => {
            const t = line.trim();
            if (!t || t.startsWith("#") || t.startsWith("http://") || t.startsWith("https://")) return line;
            return base + t;
          }).join("\n");
          const blob = new Blob([absoluteTxt], { type: "application/vnd.apple.mpegurl" });
          const blobUrl = URL.createObjectURL(blob);
          const curTime = videoEl.currentTime || 0;
          videoEl.src = blobUrl;
          if (curTime > 0) videoEl.currentTime = curTime;
        }
      }).catch(() => {});
      videoEl.addEventListener("loadedmetadata", () => {
        this.actualVideoRes.width = videoEl.videoWidth || 1920;
        this.actualVideoRes.height = videoEl.videoHeight || 1080;
        this.renderDynamicQualityButtons();
        this.renderDynamicResumeButtons();
        this.applyVideoQualityVisuals();
        videoEl.play().catch(() => {});
        const savedProg = this.getPlaybackProgress(movie.slug, epIndex);
        if (savedProg && savedProg.currentTime > 5 && savedProg.percentage < 95) {
          videoEl.currentTime = savedProg.currentTime;
          this.showResumeFloatingBanner(savedProg);
          this.showToast(`▶ Đang tiếp tục xem từ ${this.formatSeconds(savedProg.currentTime)} (${savedProg.percentage}%)`);
        }
      });
    }

    videoEl.onloadedmetadata = () => {
      if (videoEl.videoWidth && videoEl.videoHeight) {
        this.actualVideoRes.width = videoEl.videoWidth;
        this.actualVideoRes.height = videoEl.videoHeight;
        this.renderDynamicQualityButtons();
        this.renderDynamicResumeButtons();
        this.applyVideoQualityVisuals();
      }
    };

    this.renderDynamicQualityButtons();
    this.renderDynamicResumeButtons();
    this.applyVideoQualityVisuals();

    // Đồng bộ thanh thời gian với Apple Music Now Playing Bar, Apple Video Player & lưu xem tiếp tục
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

      // Đồng bộ thanh timeline chuẩn Apple Video Player
      const appleCur = document.getElementById("appleCurrentTime");
      const appleDur = document.getElementById("appleDurationTime");
      const appleFill = document.getElementById("appleScrubFill");
      const appleThumb = document.getElementById("appleScrubThumb");
      if (appleCur) appleCur.textContent = this.formatSeconds(videoEl.currentTime);
      if (appleDur) appleDur.textContent = this.formatSeconds(videoEl.duration);
      if (appleFill) appleFill.style.width = `${pct}%`;
      if (appleThumb) appleThumb.style.left = `${pct}%`;

      // Cập nhật trạng thái nút Play trên giao diện Apple
      const applePlayIcon = document.getElementById("applePlayIcon");
      if (applePlayIcon) {
        applePlayIcon.className = videoEl.paused ? "fas fa-play" : "fas fa-pause";
      }

      // Tự động lưu vị trí thời gian thực nếu thoát giữa chừng
      if (videoEl.currentTime > 5 && (!videoEl._lastSavedPos || Math.abs(videoEl.currentTime - videoEl._lastSavedPos) >= 3)) {
        videoEl._lastSavedPos = videoEl.currentTime;
        if (this.selectedMovie) {
          this.savePlaybackProgress(this.selectedMovie.slug, this.currentEpisodeIndex, videoEl.currentTime, videoEl.duration);
          this.renderDynamicResumeButtons();
        }
      }
    };
  }

  skipAdIntro(seconds = 5) {
    this.seekRelative(seconds, true);
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
    if (maxDim >= 3800 || h >= 2100) return "4K Ultra HD";
    if (maxDim >= 2500 || h >= 1400) return "2K QHD";
    if (maxDim >= 1800 || h >= 800) return "1080p Full HD";
    if (maxDim >= 1200 || h >= 680) return "720p HD";
    if (maxDim >= 800 || h >= 460) return "480p";
    if (maxDim > 0) return `${h}p`;
    return "1080p Full HD";
  }

  buildQualityButtonsHTML(movie) {
    const mov = movie || this.selectedMovie || this.playingMovie;
    // Chỉ kích hoạt 4K khi thực sự có luồng 4K UHD thật (chiều rộng >= 3840 hoặc chiều cao >= 2160, hoặc altSources có server 4K)
    const hasReal4kStream = Boolean(
      (this.detectedHlsLevels && this.detectedHlsLevels.length > 1 && this.detectedHlsLevels.some((l) => l.height >= 2160 || l.width >= 3840)) ||
      (mov?.episodes?.some((ep) => ep.altSources?.some((a) => (a.label || "").toLowerCase().includes("4k") || (a.source || "").toLowerCase().includes("4k")))) ||
      ((mov?.quality === "4K" || mov?.nativeQuality === "4K") && (mov?.episodes?.some((ep) => (ep.source || "").toLowerCase().includes("4k") || (ep.name || "").toLowerCase().includes("4k"))))
    );

    const is4k = this.currentQuality === "4K" || this.currentQuality === "4k";

    // Phim không có định dạng 4K thực tế thì chỉ hiển thị nút 1080 (không hiện nút 4K ảo)
    if (!hasReal4kStream) {
      return `
        <button class="quality-pill-btn active" 
                onclick="app.handleQualityPillClick('1080', false)"
                title="Full HD 1080p • Nét Chuẩn Bản Quyền Từ Máy Chủ">
          1080
        </button>
      `;
    }

    return `
      <button class="quality-pill-btn ${!is4k ? "active" : ""}" 
              onclick="app.switchQualityTier('1080')" 
              title="Full HD 1080p • Nét Chuẩn Bản Quyền">
        1080
      </button>
      <button class="quality-pill-btn is-4k-quality ${is4k ? "active" : ""}" 
              onclick="app.switchQualityTier('4K')" 
              title="4K Ultra HD • Siêu Nét HDR • Apple Reality Engine">
        <i class="fas fa-sparkles" style="font-size:0.7em; margin-right:3px;"></i>4K
      </button>
    `;
  }

  /* ==========================================================================
     RESUME PLAYBACK TOOLBAR CONTROLS & APPLE FLOATING BANNER
     ========================================================================== */
  buildResumeButtonsHTML(movie, epIndex = 0) {
    if (!movie) return "";
    const savedProg = this.getPlaybackProgress(movie.slug, epIndex);
    const hasProgress = Boolean(savedProg && savedProg.currentTime > 5 && savedProg.percentage < 95);

    if (hasProgress) {
      return `
        <span class="server-label"><i class="fas fa-clock-rotate-left"></i> Xem tiếp:</span>
        <div class="resume-selector-group">
          <button class="resume-pill-btn active" onclick="app.resumePlaybackAt(${savedProg.currentTime})" title="Tiếp tục xem từ ${this.formatSeconds(savedProg.currentTime)} (${savedProg.percentage}%)">
            <i class="fas fa-play" style="font-size:0.68em; margin-right:4px;"></i>${this.formatSeconds(savedProg.currentTime)} (${savedProg.percentage}%)
          </button>
          <button class="resume-pill-btn restart-btn" onclick="app.restartPlayback()" title="Phát lại từ đầu (00:00)">
            <i class="fas fa-rotate-left" style="font-size:0.68em; margin-right:3px;"></i>Từ đầu
          </button>
        </div>
      `;
    }

    return `
      <span class="server-label"><i class="fas fa-clock-rotate-left"></i> Xem tiếp:</span>
      <div class="resume-selector-group">
        <button class="resume-pill-btn active" onclick="app.restartPlayback()" title="Đang phát từ đầu (00:00)">
          <i class="fas fa-play" style="font-size:0.68em; margin-right:4px;"></i>Phát từ đầu
        </button>
      </div>
    `;
  }

  renderDynamicResumeButtons() {
    const group = document.getElementById("resumeToolbarContainer");
    if (group && this.selectedMovie) {
      group.innerHTML = this.buildResumeButtonsHTML(this.selectedMovie, this.currentEpisodeIndex);
    }
  }

  resumePlaybackAt(time) {
    const videoEl = document.getElementById("hlsVideoElement");
    if (videoEl && !isNaN(time)) {
      videoEl.currentTime = time;
      videoEl.play().catch(() => {});
      this.showToast(`▶ Đã tiếp tục xem từ ${this.formatSeconds(time)}`);
      this.dismissResumeBanner();
    }
  }

  showResumeFloatingBanner(savedProg) {
    this.dismissResumeBanner();
    const container = document.getElementById("activeVideoContainer");
    if (!container) return;

    const banner = document.createElement("div");
    banner.className = "apple-resume-banner";
    banner.id = "appleResumeBanner";
    banner.innerHTML = `
      <div class="apple-resume-text">
        <i class="fas fa-clock-rotate-left" style="color: #38ef7d;"></i>
        Tiếp tục xem từ <strong>${this.formatSeconds(savedProg.currentTime)}</strong> (${savedProg.percentage}%)
      </div>
      <div class="apple-resume-actions">
        <button class="apple-resume-btn resume-now" onclick="app.resumePlaybackAt(${savedProg.currentTime})">
          <i class="fas fa-play" style="font-size:0.75em; margin-right:4px;"></i>Xem tiếp
        </button>
        <button class="apple-resume-btn resume-restart" onclick="app.restartPlayback()">
          <i class="fas fa-rotate-left" style="font-size:0.75em; margin-right:4px;"></i>Từ đầu
        </button>
        <button class="apple-resume-close" onclick="app.dismissResumeBanner()" aria-label="Đóng"><i class="fas fa-times"></i></button>
      </div>
    `;
    container.appendChild(banner);

    clearTimeout(this._resumeBannerTimeout);
    this._resumeBannerTimeout = setTimeout(() => {
      this.dismissResumeBanner();
    }, 7000);
  }

  dismissResumeBanner() {
    clearTimeout(this._resumeBannerTimeout);
    const existing = document.getElementById("appleResumeBanner");
    if (existing) {
      existing.style.animation = "appleResumeFadeOut 0.25s ease forwards";
      setTimeout(() => existing.remove(), 250);
    }
  }

  handleQualityPillClick(label, isReal4k) {
    if (!isReal4k) {
      this.showToast("✨ Đang phát chất lượng Full HD 1080p sắc nét nhất từ API.");
    } else {
      this.showToast("✨ Đang phát chất lượng thực tế: 4K Ultra HD");
    }
  }

  switchHlsLevel(lvlIndex) {
    if (!this.hlsInstance) return;
    this.hlsInstance.currentLevel = lvlIndex;
    this.hlsInstance.loadLevel = lvlIndex;
    const lvl = this.detectedHlsLevels?.[lvlIndex];
    if (lvl) {
      this.actualVideoRes.width = lvl.width;
      this.actualVideoRes.height = lvl.height;
      this.actualVideoRes.bitrateMbps = lvl.bitrateMbps;
      this.renderDynamicQualityButtons();
      this.applyVideoQualityVisuals();
      this.showToast(`✨ Đã chuyển sang chất lượng thực: ${lvl.tier} (${lvl.width}×${lvl.height} • ${lvl.bitrateMbps} Mbps)`);
    }
  }

  switchQualityTier(tier) {
    const is4k = tier === "4k" || tier === "4K";
    this.currentQuality = is4k ? "4K" : "1080";

    const videoEl = document.getElementById("hlsVideoElement");
    const resumeTime = videoEl ? videoEl.currentTime : 0;
    const wasPlaying = videoEl ? !videoEl.paused : true;

    // Khi chuyển sang 4K: nạp lại/chuyển sang luồng 4K chất lượng cao nhất
    if (is4k) {
      const ep = this.selectedMovie?.episodes?.[this.currentEpisodeIndex] || this.selectedMovie?.episodes?.[0];
      const alt4k = ep?.altSources?.find((a) => (a.label || "").toLowerCase().includes("4k") || (a.source || "").toLowerCase().includes("4k"));
      if (alt4k && alt4k.source && this.hlsInstance && this.hlsInstance.url !== alt4k.source) {
        this.hlsInstance.loadSource(alt4k.source);
        this.hlsInstance.once(window.Hls.Events.MANIFEST_PARSED, () => {
          if (videoEl && resumeTime > 1) videoEl.currentTime = resumeTime;
          if (wasPlaying) videoEl?.play().catch(() => {});
        });
      } else if (this.detectedHlsLevels && this.detectedHlsLevels.length > 1) {
        let highestIdx = this.detectedHlsLevels.length - 1;
        let maxMetric = 0;
        this.detectedHlsLevels.forEach((lvl, idx) => {
          const metric = (lvl.width || 0) * (lvl.height || 0) * (lvl.bitrateMbps || 1);
          if (metric > maxMetric) {
            maxMetric = metric;
            highestIdx = idx;
          }
        });
        if (this.hlsInstance) {
          this.hlsInstance.currentLevel = highestIdx;
          this.hlsInstance.loadLevel = highestIdx;
          this.hlsInstance.nextLevel = highestIdx;
        }
      }
    } else {
      // Chuyển về 1080: Nếu có mức 1080p, khóa ở mức 1080
      if (this.detectedHlsLevels && this.detectedHlsLevels.length > 1) {
        const fhdIdx = this.detectedHlsLevels.findIndex((lvl) => (lvl.height >= 800 && lvl.height <= 1080) || (lvl.width >= 1800 && lvl.width <= 1920));
        const targetIdx = fhdIdx !== -1 ? fhdIdx : 0;
        if (this.hlsInstance) {
          this.hlsInstance.currentLevel = targetIdx;
          this.hlsInstance.loadLevel = targetIdx;
          this.hlsInstance.nextLevel = targetIdx;
        }
      }
    }

    this.renderDynamicQualityButtons();
    this.applyVideoQualityVisuals();

    // Thông báo toast tinh tế, không hiện icon HUD tròn đè giữa khung hình
    if (is4k) {
      this.showToast("✨ Đã kích hoạt 4K Ultra HD sắc nét");
    } else {
      this.showToast("✨ Đang phát chuẩn Full HD 1080p");
    }
  }

  renderDynamicQualityButtons() {
    const group = document.getElementById("qualitySelectorGroup");
    if (group) {
      group.innerHTML = this.buildQualityButtonsHTML(this.selectedMovie);
    }
  }

  getQualityLabel(q) {
    const is4k = this.currentQuality === "4K" || this.currentQuality === "4k";
    if (is4k) {
      return "4K Ultra HD • Siêu Nét • HDR Reality Engine";
    }
    return "Full HD 1080 • Nét Chuẩn";
  }

  getQualityVideoClass(q) {
    const is4k = q === "4K" || q === "4k" || this.currentQuality === "4K" || this.currentQuality === "4k";
    return is4k ? "quality-4k-enhanced" : "";
  }

  applyVideoQualityVisuals() {
    const videoEl = document.getElementById("hlsVideoElement");
    if (!videoEl) return;
    const is4k = this.currentQuality === "4K" || this.currentQuality === "4k";
    videoEl.classList.toggle("quality-4k-enhanced", is4k);
  }

  setVideoQuality(qualityMode, showNotification = true) {
    // Nếu người dùng bấm chuyển sang luồng .m3u8 hoặc Server phụ (alt-0, alt-1...)
    if (qualityMode.startsWith("alt-")) {
      const altIdx = parseInt(qualityMode.replace("alt-", ""), 10);
      const ep = this.selectedMovie?.episodes?.[this.currentEpisodeIndex] || this.selectedMovie?.episodes?.[0];
      const altObj = ep?.altSources?.[altIdx];
      if (altObj) {
        const videoEl = document.getElementById("hlsVideoElement");
        const iframeEl = document.getElementById("trailerIframeElement");
        const isAltM3u8 = altObj.source && (altObj.source.includes(".m3u8") || altObj.source.includes("/hls/"));
        if (isAltM3u8 && this.hlsInstance) {
          const resumeTime = videoEl ? videoEl.currentTime : 0;
          this.currentQuality = qualityMode;
          this.hlsInstance.loadSource(altObj.source);
          this.hlsInstance.once(window.Hls.Events.MANIFEST_PARSED, () => {
            if (videoEl && resumeTime > 1) videoEl.currentTime = resumeTime;
            videoEl?.play().catch(() => {});
          });
        } else if (iframeEl) {
          this.destroyHls();
          if (videoEl) {
            videoEl.pause();
            videoEl.style.display = "none";
          }
          iframeEl.src = altObj.embed || altObj.source;
          iframeEl.style.display = "block";
        }
        this.currentQuality = qualityMode;
        this.renderDynamicQualityButtons();
        if (showNotification) {
          this.showToast(`Đã chuyển sang ${altObj.label}`);
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
      videoEl.classList.remove("quality-4k", "quality-2k", "quality-720p", "quality-4k-upscale");
      const cls = this.getQualityVideoClass(this.currentQuality);
      if (cls) videoEl.classList.add(cls);
    }
    const badgeText = document.getElementById("playerFloatingQualityText");
    if (badgeText) {
      badgeText.textContent = this.getQualityLabel(this.currentQuality);
    }
  }

  stopModalVideo() {
    this.isPlaying = false;
    const currentMov = this.playingMovie || this.selectedMovie;
    if (currentMov) {
      this.setNowPlayingBar(currentMov, this.currentEpisodeIndex, false);
    }
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

    if (artImg) artImg.src = this.getMoviePoster(movie);
    if (titleText) titleText.textContent = movie.title;
    const epLabel = this.formatEpisodeLabel(ep ? ep.name : "Tập 1", "Tập 1");
    if (subText) {
      subText.textContent = `${epLabel} • ${movie.originTitle} (${movie.quality})`;
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

    if (islandBackdrop) islandBackdrop.src = this.getMovieBackdrop(movie);
    if (islandTitle) islandTitle.textContent = movie.title;
    if (islandDuration) islandDuration.textContent = movie.duration || "1080";
    if (islandQuality) islandQuality.textContent = movie.quality || "1080";
    if (islandLang) islandLang.textContent = this.getMovieLanguageLabel(movie);
    if (islandEp) islandEp.textContent = epLabel;
    if (islandPlayIcon) islandPlayIcon.className = playing ? "fas fa-pause" : "fas fa-play";
    const miniCenterPlay = document.getElementById("miniScreenCenterPlayIcon");
    if (miniCenterPlay) miniCenterPlay.className = playing ? "fas fa-pause" : "fas fa-play";

    // Đồng bộ nhãn trạng thái ĐANG PHÁT / TẠM DỪNG
    const islandLiveBadge = document.getElementById("nowPlayingIslandLiveBadge");
    const islandLiveText = document.getElementById("nowPlayingIslandLiveText");
    if (islandLiveBadge) islandLiveBadge.classList.toggle("paused", !playing);
    if (islandLiveText) islandLiveText.textContent = playing ? "ĐANG PHÁT" : "TẠM DỪNG";

    // Đồng bộ nút yêu thích mini player
    const miniFavBtn = document.getElementById("miniPlayerFavBtn");
    const miniFavIcon = document.getElementById("miniPlayerFavIcon");
    if (miniFavBtn) {
      const isFav = this.isInMyList(movie);
      miniFavBtn.classList.toggle("active", isFav);
      if (miniFavIcon) {
        miniFavIcon.className = isFav ? "fas fa-star" : "far fa-star";
      }
    }
  }

  /* ==========================================================================
     APPLE CINEMA VIDEO PLAYER CONTROLLER (APPLE TV+ / VISIONOS CHẾ ĐỘ XEM VIDEO)
     ========================================================================== */
  initAppleVideoPlayerEvents() {
    const container = document.getElementById("activeVideoContainer");
    const videoEl = document.getElementById("hlsVideoElement");
    if (!container || !videoEl) return;

    // Đồng bộ trạng thái lớp che banner quảng cáo/watermark
    // Tự động rà soát & làm sạch phụ đề WebVTT/TextTrack nếu phát hiện chèn quảng cáo nhà cái
    const sanitizeTrackCues = (track) => {
      if (!track) return;
      const cleanCues = () => {
        if (!track.cues) return;
        const badKeywords = [
          "i999", "cwin", "nohu", "nổ hũ", "bắn cá", "sòng bài", "rút tiền",
          "tài trợ", "nhà cái", "kubet", "thabet", "cá cược", "đặt cược"
        ];
        for (let i = track.cues.length - 1; i >= 0; i--) {
          const cue = track.cues[i];
          if (cue && cue.text) {
            const lower = cue.text.toLowerCase();
            if (badKeywords.some((kw) => lower.includes(kw))) {
              try { track.removeCue(cue); } catch (e) {}
            }
          }
        }
      };
      try {
        track.addEventListener("cuechange", cleanCues);
        cleanCues();
      } catch (_) {}
    };

    if (videoEl.textTracks) {
      for (let i = 0; i < videoEl.textTracks.length; i++) {
        sanitizeTrackCues(videoEl.textTracks[i]);
      }
      videoEl.textTracks.onaddtrack = (e) => {
        if (e && e.track) sanitizeTrackCues(e.track);
      };
    }

    // Hiển thị thanh điều khiển Apple khi phát luồng native
    const appleOverlay = document.getElementById("applePlayerOverlay");
    if (appleOverlay) appleOverlay.style.display = "flex";

    // Auto-hide controls khi xem phim (2.5 giây không di chuột)
    const resetControlsTimer = () => {
      container.classList.remove("controls-hidden");
      if (this._appleControlsTimeout) {
        clearTimeout(this._appleControlsTimeout);
        this._appleControlsTimeout = null;
      }
      if (!videoEl.paused) {
        this._appleControlsTimeout = setTimeout(() => {
          if (!videoEl.paused) {
            container.classList.add("controls-hidden");
          }
        }, 2500);
      }
    };

    container.onmousemove = resetControlsTimer;
    container.onmousedown = resetControlsTimer;
    container.ontouchstart = resetControlsTimer;

    videoEl.onplay = () => {
      this.isPlaying = true;
      const playIcon = document.getElementById("applePlayIcon");
      if (playIcon) playIcon.className = "fas fa-pause";
      this.setNowPlayingBar(this.playingMovie, this.currentEpisodeIndex, true);
      resetControlsTimer();
      // Bỏ focus của browser để triệt tiêu vĩnh viễn viền xanh
      videoEl.blur();
    };

    videoEl.onpause = () => {
      this.isPlaying = false;
      const playIcon = document.getElementById("applePlayIcon");
      if (playIcon) playIcon.className = "fas fa-play";
      this.setNowPlayingBar(this.playingMovie, this.currentEpisodeIndex, false);
      container.classList.remove("controls-hidden");
      videoEl.blur();
    };

    videoEl.onprogress = () => {
      if (!videoEl.duration || !videoEl.buffered.length) return;
      try {
        const bufferedEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
        const bufPct = Math.min(100, (bufferedEnd / videoEl.duration) * 100);
        const bufEl = document.getElementById("appleScrubBuffer");
        if (bufEl) bufEl.style.width = `${bufPct}%`;
      } catch (_) {}
    };

    videoEl.onvolumechange = () => {
      const volSlider = document.getElementById("appleVolSlider");
      const volIcon = document.getElementById("appleVolIcon");
      if (volSlider) volSlider.value = videoEl.muted ? 0 : videoEl.volume;
      if (volIcon) {
        if (videoEl.muted || videoEl.volume === 0) {
          volIcon.className = "fas fa-volume-xmark";
        } else if (videoEl.volume < 0.5) {
          volIcon.className = "fas fa-volume-low";
        } else {
          volIcon.className = "fas fa-volume-high";
        }
      }
    };
  }

  toggleVideoPlayPause(e) {
    if (e) e.stopPropagation();
    const videoEl = document.getElementById("hlsVideoElement");
    if (!videoEl) return;
    if (videoEl.paused) {
      videoEl.play().catch(() => {});
      this.showAppleVideoHud("play");
    } else {
      videoEl.pause();
      this.showAppleVideoHud("pause");
    }
    videoEl.blur();
  }

  handleAppleVideoClick(e) {
    if (e) e.stopPropagation();
    if (this._videoClickTimeout) {
      clearTimeout(this._videoClickTimeout);
      this._videoClickTimeout = null;
      this.toggleVideoFullscreen();
      return;
    }
    this._videoClickTimeout = setTimeout(() => {
      this._videoClickTimeout = null;
      this.toggleVideoPlayPause();
    }, 240);
  }

  showAppleVideoHud(type, customText) {
    const hud = document.getElementById("appleVideoHud");
    const icon = document.getElementById("appleHudIcon");
    const text = document.getElementById("appleHudText");
    if (!hud || !icon) return;

    let iconClass = "fas fa-play";
    let textContent = customText || "";

    switch (type) {
      case "play":
        iconClass = "fas fa-play";
        textContent = "";
        break;
      case "pause":
        iconClass = "fas fa-pause";
        textContent = "";
        break;
      case "forward":
        iconClass = "fas fa-rotate-right";
        textContent = customText || "+10s";
        break;
      case "backward":
        iconClass = "fas fa-rotate-left";
        textContent = customText || "-10s";
        break;
      case "volume":
        iconClass = "fas fa-volume-high";
        textContent = customText || "100%";
        break;
      case "mute":
        iconClass = "fas fa-volume-xmark";
        textContent = "Tắt âm";
        break;
      case "unmute":
        iconClass = "fas fa-volume-high";
        textContent = "Bật âm";
        break;
      case "speed":
        iconClass = "fas fa-gauge-high";
        textContent = customText || "1.0x";
        break;
      case "theater":
        iconClass = "fas fa-masks-theater";
        textContent = customText || "Rạp phim";
        break;
    }

    icon.className = iconClass;
    if (text) {
      text.textContent = textContent;
      text.style.display = textContent ? "block" : "none";
    }

    hud.classList.remove("hud-active");
    requestAnimationFrame(() => {
      hud.classList.add("hud-active");
    });

    if (this._appleHudTimer) clearTimeout(this._appleHudTimer);
    this._appleHudTimer = setTimeout(() => {
      hud.classList.remove("hud-active");
    }, 550);
  }

  seekRelative(seconds = 5, showHud = false, e) {
    if (e) e.stopPropagation();
    const videoEl = document.getElementById("hlsVideoElement");
    if (videoEl && !isNaN(videoEl.duration)) {
      videoEl.currentTime = Math.max(0, Math.min(videoEl.duration, videoEl.currentTime + seconds));
      if (showHud) {
        this.showAppleVideoHud(seconds > 0 ? "forward" : "backward", `${seconds > 0 ? "+" : ""}${seconds}s`);
      }
    }
  }

  setVideoVolume(val, showHud = false) {
    const videoEl = document.getElementById("hlsVideoElement");
    if (!videoEl) return;
    const v = Math.max(0, Math.min(1, parseFloat(val)));
    videoEl.volume = v;
    videoEl.muted = (v === 0);
    if (showHud) {
      this.showAppleVideoHud("volume", `${Math.round(v * 100)}%`);
    }
  }

  adjustVideoVolume(delta) {
    const videoEl = document.getElementById("hlsVideoElement");
    if (!videoEl) return;
    const current = videoEl.muted ? 0 : videoEl.volume;
    const next = Math.max(0, Math.min(1, current + delta));
    this.setVideoVolume(next, true);
  }

  toggleVideoMute(e) {
    if (e) e.stopPropagation();
    const videoEl = document.getElementById("hlsVideoElement");
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
    this.showAppleVideoHud(videoEl.muted ? "mute" : "unmute");
  }

  cyclePlaybackSpeed(e) {
    if (e) e.stopPropagation();
    const videoEl = document.getElementById("hlsVideoElement");
    if (!videoEl) return;
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const currentSpeed = videoEl.playbackRate || 1.0;
    const nextIdx = (speeds.indexOf(currentSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    videoEl.playbackRate = nextSpeed;
    const textEl = document.getElementById("appleSpeedText");
    if (textEl) textEl.textContent = `${nextSpeed}x`;
    this.showAppleVideoHud("speed", `${nextSpeed}x`);
  }

  toggleVideoTheaterMode(e) {
    if (e) e.stopPropagation();
    const modal = document.getElementById("movieDetailModal");
    const sheet = document.getElementById("movieDetailSheet");
    if (!sheet) return;
    const isTheater = sheet.classList.toggle("apple-theater-mode");
    modal?.classList.toggle("lights-off", isTheater);
    this.showAppleVideoHud("theater", isTheater ? "Rạp phim: Bật" : "Rạp phim: Tắt");
  }

  toggleWatermarkShield(e) {
    if (e) e.stopPropagation();
    const shield = document.getElementById("appleWatermarkShield");
    const icon = document.getElementById("appleShieldIcon");
    const btn = document.getElementById("appleShieldBtn");
    if (!shield) return;
    const isHidden = shield.classList.toggle("disabled");
    if (icon) {
      icon.className = isHidden ? "fas fa-eye" : "fas fa-eye-slash";
    }
    if (btn) {
      btn.classList.toggle("active", !isHidden);
      btn.title = isHidden ? "Khử Logo & Watermark (Đang Tắt - Phím W)" : "Khử Logo & Watermark (Đang Bật - Phím W)";
    }
    if (isHidden) {
      this.showToast("Đã tắt lớp khử Logo & Watermark");
      this.showAppleVideoHud("forward", "Logo: Hiện");
    } else {
      this.showToast("🛡️ Đã bật khử Logo & Watermark (HHPANDA, YanHH3D)");
      this.showAppleVideoHud("forward", "Khử Logo: Bật");
    }
  }

  toggleVideoPip(e) {
    if (e) e.stopPropagation();
    const videoEl = document.getElementById("hlsVideoElement");
    if (!videoEl) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    } else if (videoEl.requestPictureInPicture) {
      videoEl.requestPictureInPicture().catch(() => {});
    }
  }

  toggleVideoFullscreen(e) {
    if (e) e.stopPropagation();
    const stage = document.getElementById("activeVideoContainer") || document.getElementById("modalPlayerStage");
    if (!stage) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
      if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {});
      else if (stage.webkitRequestFullscreen) stage.webkitRequestFullscreen();
    }
  }

  startScrubbing(e) {
    if (e) e.preventDefault();
    const track = document.getElementById("appleScrubContainer");
    const videoEl = document.getElementById("hlsVideoElement");
    if (!track || !videoEl || !videoEl.duration) return;

    const scrub = (moveEvent) => {
      const rect = track.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      videoEl.currentTime = pos * videoEl.duration;
      const fillEl = document.getElementById("appleScrubFill");
      const thumbEl = document.getElementById("appleScrubThumb");
      if (fillEl) fillEl.style.width = `${pos * 100}%`;
      if (thumbEl) thumbEl.style.left = `${pos * 100}%`;
    };

    scrub(e);

    const onMouseMove = (moveEvent) => {
      scrub(moveEvent);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  previewScrubTime(e) {
    const track = document.getElementById("appleScrubContainer");
    const tooltip = document.getElementById("appleScrubTooltip");
    const videoEl = document.getElementById("hlsVideoElement");
    if (!track || !tooltip || !videoEl || !videoEl.duration) return;

    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSeconds = pct * videoEl.duration;

    tooltip.textContent = this.formatSeconds(targetSeconds);
    tooltip.style.left = `${e.clientX - rect.left}px`;
    tooltip.classList.add("visible");
  }

  hideScrubTimePreview() {
    document.getElementById("appleScrubTooltip")?.classList.remove("visible");
  }

  toggleNowPlayingPlayPause() {
    if (!this.playingMovie) return;
    const modalOpen = document.getElementById("movieDetailModal")?.classList.contains("open");
    const videoEl = document.getElementById("hlsVideoElement");

    if (modalOpen && videoEl && videoEl.style.display !== "none") {
      this.toggleVideoPlayPause();
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

    // 1. TÌM KIẾM TỨC THÌ 0ms VỚI CHỈ MỤC ĐÃ ĐƯỢC TIỀN TÍNH TOÁN (SMART RELEVANCE RANKING)
    const q = query.toLowerCase();
    const scored = [];
    const movies = this.service.movies;
    for (let i = 0; i < movies.length; i++) {
      const m = movies[i];
      const t = m._titleLower || (m._titleLower = (m.title || "").toLowerCase());
      const o = m._originLower || (m._originLower = (m.originTitle || "").toLowerCase());
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
        const meta = m._metaSearch || (m._metaSearch = `${(m.genres || []).join(" ")} ${(m.cast || []).join(" ")} ${m.director || ""}`.toLowerCase());
        if (meta.includes(q)) {
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
              <img src="${m.poster}" alt="${m.title}" loading="lazy" decoding="async" />
              <div class="search-suggestion-info">
                <div class="search-suggestion-title">${m.title}</div>
                <div class="search-suggestion-meta">
                  <span class="badge-mini">${m.quality || "1080"}</span>
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
      this.showToast(`Đã xóa "${movie.title}" khỏi Danh sách yêu thích`);
    } else {
      this.myList.unshift(movie.slug);
      this.showToast(`Đã thêm "${movie.title}" vào Danh sách yêu thích`);
    }

    this.saveStorage("apple_cinema_mylist", this.myList);
    this.updateSidebarCounts();
    this.renderMainView();

    // Cập nhật nút trong Modal nếu đang mở
    const modalBtn = document.getElementById("modalMyListBtn");
    if (modalBtn && this.selectedMovie && this.selectedMovie.slug === movie.slug) {
      const saved = this.isInMyList(movie);
      modalBtn.classList.toggle("active", saved);
      modalBtn.innerHTML = `<i class="${saved ? "fas fa-star" : "far fa-star"}"></i><span>${saved ? "Đã Lưu Yêu Thích" : "Lưu Yêu Thích"}</span>`;
    }

    // Cập nhật nút trong Mini Player Bar nếu đang phát phim này
    const miniFavBtn = document.getElementById("miniPlayerFavBtn");
    const miniFavIcon = document.getElementById("miniPlayerFavIcon");
    if (miniFavBtn && this.playingMovie && (this.playingMovie.slug === movie.slug || this.playingMovie.id === movie.id)) {
      const saved = this.isInMyList(movie);
      miniFavBtn.classList.toggle("active", saved);
      if (miniFavIcon) {
        miniFavIcon.className = saved ? "fas fa-star" : "far fa-star";
      }
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
        requestAnimationFrame(() => {
          newHero.classList.add("vision-hero-slide-anim");
        });
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
    const btn = document.getElementById("lightsOffBtn");
    if (btn) {
      btn.title = this.lightsOff ? "Bật Đèn" : "Tắt Đèn Rạp";
      btn.classList.toggle("active", this.lightsOff);
    }
  }


  findMovie(idOrSlug) {
    if (!idOrSlug) return null;
    const cleanSlug = idOrSlug === "ly-hung-mieu" ? "ly-hung-mieu-gau-truc-ly" : idOrSlug;
    return (
      this.service.slugMap.get(cleanSlug) ||
      this.service.slugMap.get(idOrSlug) ||
      this.service.movies.find((m) => m.id === cleanSlug || m.slug === cleanSlug || m.id === idOrSlug || m.slug === idOrSlug)
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

    // Đóng dropdown tìm kiếm, notification center hoặc Dynamic Island khi click ra ngoài
    document.addEventListener("click", (e) => {
      const searchBox = document.querySelector(".topbar-search-container");
      if (searchBox && !searchBox.contains(e.target)) {
        document.getElementById("searchDropdown")?.classList.remove("open");
      }
      const playerBar = document.getElementById("applePlayerBar");
      if (playerBar && playerBar.classList.contains("is-expanded") && !playerBar.contains(e.target)) {
        playerBar.classList.remove("is-expanded");
      }
      const flyout = document.getElementById("visionNotifFlyout");
      const bellBtn = document.getElementById("notifBellBtn");
      if (flyout && flyout.style.display !== "none") {
        if (!flyout.contains(e.target) && !bellBtn?.contains(e.target)) {
          this.closeNotificationCenter();
        }
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
        this.closeNotificationCenter();
        document.getElementById("applePlayerBar")?.classList.remove("is-expanded");
        if (document.getElementById("movieDetailModal")?.classList.contains("open")) {
          this.closeMovieModal();
        }
      } else if (e.code === "Space" && !isInput) {
        e.preventDefault();
        const modal = document.getElementById("movieDetailModal");
        const videoEl = document.getElementById("hlsVideoElement");
        const modalOpen = modal?.classList.contains("open");
        const videoVisible = videoEl && videoEl.style.display !== "none";

        if (modalOpen && videoVisible) {
          this.toggleVideoPlayPause();
        } else {
          this.toggleNowPlayingPlayPause();
        }
      } else if (e.code === "ArrowLeft" && !isInput) {
        const modal = document.getElementById("movieDetailModal");
        const videoEl = document.getElementById("hlsVideoElement");
        if (modal?.classList.contains("open") && videoEl && videoEl.style.display !== "none") {
          e.preventDefault();
          this.seekRelative(-5, true);
        }
      } else if (e.code === "ArrowRight" && !isInput) {
        const modal = document.getElementById("movieDetailModal");
        const videoEl = document.getElementById("hlsVideoElement");
        if (modal?.classList.contains("open") && videoEl && videoEl.style.display !== "none") {
          e.preventDefault();
          this.seekRelative(5, true);
        }
      } else if (e.code === "ArrowUp" && !isInput) {
        const modal = document.getElementById("movieDetailModal");
        const videoEl = document.getElementById("hlsVideoElement");
        if (modal?.classList.contains("open") && videoEl && videoEl.style.display !== "none") {
          e.preventDefault();
          this.adjustVideoVolume(0.1);
        }
      } else if (e.code === "ArrowDown" && !isInput) {
        const modal = document.getElementById("movieDetailModal");
        const videoEl = document.getElementById("hlsVideoElement");
        if (modal?.classList.contains("open") && videoEl && videoEl.style.display !== "none") {
          e.preventDefault();
          this.adjustVideoVolume(-0.1);
        }
      } else if ((e.key === "f" || e.key === "F") && !isInput) {
        const modal = document.getElementById("movieDetailModal");
        const videoEl = document.getElementById("hlsVideoElement");
        if (modal?.classList.contains("open") && videoEl) {
          e.preventDefault();
          this.toggleVideoFullscreen();
        }
      } else if ((e.key === "m" || e.key === "M") && !isInput) {
        const modal = document.getElementById("movieDetailModal");
        const videoEl = document.getElementById("hlsVideoElement");
        if (modal?.classList.contains("open") && videoEl && videoEl.style.display !== "none") {
          e.preventDefault();
          this.toggleVideoMute();
        } else if (videoEl) {
          videoEl.muted = !videoEl.muted;
          this.showToast(videoEl.muted ? "🔇 Đã tắt tiếng (Muted)" : "🔊 Đã bật âm thanh");
        }
      } else if ((e.key === "t" || e.key === "T") && !isInput) {
        const modal = document.getElementById("movieDetailModal");
        const videoEl = document.getElementById("hlsVideoElement");
        if (modal?.classList.contains("open") && videoEl && videoEl.style.display !== "none") {
          e.preventDefault();
          this.toggleVideoTheaterMode();
        }
      } else if ((e.key === "s" || e.key === "S") && !isInput) {
        const modal = document.getElementById("movieDetailModal");
        const videoEl = document.getElementById("hlsVideoElement");
        if (modal?.classList.contains("open") && videoEl && videoEl.style.display !== "none") {
          e.preventDefault();
          this.skipAdIntro(15);
        }
      } else if ((e.key === "w" || e.key === "W") && !isInput) {
        const modal = document.getElementById("movieDetailModal");
        const videoEl = document.getElementById("hlsVideoElement");
        if (modal?.classList.contains("open") && videoEl && videoEl.style.display !== "none") {
          e.preventDefault();
          this.toggleWatermarkShield();
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

  /* ==========================================================================
     CINEMA NOTIFICATION CENTER (Hôm Nay Có Phim Gì • Tin Tức • Sắp Chiếu)
     ========================================================================== */
  toggleNotificationCenter(e) {
    if (e) e.stopPropagation();
    const flyout = document.getElementById("visionNotifFlyout");
    if (!flyout) return;
    if (flyout.style.display === "none" || !flyout.style.display) {
      this.renderNotificationFlyout(this.activeNotifTab || "today");
      flyout.style.display = "flex";
      const dot = document.querySelector(".vision-notif-dot");
      if (dot) dot.style.display = "none";
    } else {
      flyout.style.display = "none";
    }
  }

  closeNotificationCenter() {
    const flyout = document.getElementById("visionNotifFlyout");
    if (flyout) flyout.style.display = "none";
  }

  switchNotifTab(tab) {
    this.activeNotifTab = tab;
    this.renderNotificationFlyout(tab);
  }

  renderNotificationFlyout(activeTab = "today") {
    const flyout = document.getElementById("visionNotifFlyout");
    if (!flyout) return;

    this.activeNotifTab = activeTab;

    const schedule = window.NGWYREN_AIR_SCHEDULE || {};
    const dayNames = {
      "thu-2": "Thứ 2",
      "thu-3": "Thứ 3",
      "thu-4": "Thứ 4",
      "thu-5": "Thứ 5",
      "thu-6": "Thứ 6",
      "thu-7": "Thứ 7",
      "chu-nhat": "Chủ Nhật"
    };

    const now = new Date();
    const jsDay = now.getDay();
    const todayKey = jsDay === 0 ? "chu-nhat" : `thu-${jsDay + 1}`;
    const tomorrowJsDay = (jsDay + 1) % 7;
    const tomorrowKey = tomorrowJsDay === 0 ? "chu-nhat" : `thu-${tomorrowJsDay + 1}`;

    const todayItems = schedule[todayKey] || [];
    const tomorrowItems = schedule[tomorrowKey] || [];

    // Danh mục tin tức điện ảnh & cập nhật nóng
    const cinemaNews = [
      {
        tag: "Đại Kết Cục 3D",
        headline: "Phàm Nhân Tu Tiên: Phong Khởi Lãng Lăng",
        snippet: "Hàn Lập tiến nhập Loạn Tinh Hải, đại kết cục mãn nhãn với kỹ xảo đỉnh cao. Toàn bộ tập mới cập nhật Full HD 1080p chuẩn, không quảng cáo.",
        slug: "pham-nhan-tu-tien",
        date: "Hôm nay"
      },
      {
        tag: "Tập Mới Cực Hot",
        headline: "Quang Âm Chi Ngoại: Tập Mới Lên Sóng",
        snippet: "Hứa Thanh đột phá cảnh giới mới, đại náo Thất Huyết Đồng. Luồng Full HD 1080p sắc nét, đã bật khử sạch logo watermark.",
        slug: "quang-am-chi-ngoai",
        date: "Hôm nay"
      },
      {
        tag: "Lịch Chiếu Cố Định",
        headline: "Đấu Phá Thương Khung: Niên Phiên 3",
        snippet: "Tiêu Viêm đại chiến Hồn Điện, các tập mới cập nhật cố định lúc 10:00 Sáng Chủ Nhật hàng tuần tại Ngwyren Cinema.",
        slug: "dau-pha-thuong-khung-phan-5",
        date: "Chủ Nhật"
      },
      {
        tag: "Thế Giới Hoàn Mỹ",
        headline: "Thạch Hạo Nghênh Chiến Thượng Giới Cự Đầu",
        snippet: "Tập mới vietsub và thuyết minh tiếp tục phát sóng đều đặn lúc 10:00 Sáng Thứ 6 hàng tuần.",
        slug: "the-gioi-hoan-my",
        date: "Thứ 6"
      },
      {
        tag: "Bom Tấn Netflix",
        headline: "Squid Game 3 (Trò Chơi Con Mực 3)",
        snippet: "Netflix xác nhận mùa 3 sẽ là mùa cuối khép lại cuộc chiến sinh tử, lịch phát sóng sẽ cập nhật sớm nhất.",
        slug: "squid-game-season-3",
        date: "Sắp chiếu"
      },
      {
        tag: "Chiếu Rạp 2026",
        headline: "Thanh Gươm Diệt Quỷ: Vô Hạn Thành (Trilogy)",
        snippet: "Ufotable chuyển thể trận quyết chiến Vô Hạn Thành thành bộ ba phim điện ảnh chiếu rạp đỉnh cao.",
        slug: "thanh-guom-diet-quy-vo-han-thanh",
        date: "Mới"
      }
    ];

    let bodyHTML = "";

    if (activeTab === "today") {
      if (todayItems.length > 0) {
        bodyHTML = todayItems.slice(0, 10).map((m) => `
          <div class="notif-movie-item" onclick="app.openMovieModal('${m.slug}', true); app.closeNotificationCenter();">
            <img class="notif-movie-thumb" src="${m.poster || m.backdrop}" alt="${m.title}" loading="lazy"
                 onerror="this.src='https://phimimg.com/upload/vod/20251229-1/d7f24b91fd95fb7cf353e1369e2318b7.jpg'" />
            <div class="notif-movie-info">
              <div class="notif-movie-title" title="${m.title}">${m.title}</div>
              <div class="notif-movie-meta">
                <span class="notif-badge-new"><i class="fas fa-tv"></i> ${m.currentEpisode || "Tập Mới"}</span>
                <span class="notif-badge-time"><i class="far fa-clock"></i> ${m.airTime || "Hôm nay"}</span>
                <span>• 1080p</span>
              </div>
            </div>
            <div class="notif-play-btn" title="Xem ngay">
              <i class="fas fa-play"></i>
            </div>
          </div>
        `).join("");
      } else {
        bodyHTML = `
          <div style="text-align: center; padding: 30px 16px; color: rgba(255,255,255,0.6);">
            <i class="fas fa-calendar-check" style="font-size: 2rem; color: #00f0ff; margin-bottom: 10px;"></i>
            <p>Hôm nay đã cập nhật các tập phim mới nhất trên hệ thống.</p>
          </div>
        `;
      }
    } else if (activeTab === "news") {
      bodyHTML = cinemaNews.map((n) => `
        <div class="notif-news-item" onclick="app.openMovieModal('${n.slug}', true); app.closeNotificationCenter();">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="notif-news-tag"><i class="fas fa-bolt"></i> ${n.tag}</span>
            <span style="font-size: 0.72rem; color: rgba(255,255,255,0.5);">${n.date}</span>
          </div>
          <div class="notif-news-headline">${n.headline}</div>
          <div class="notif-news-snippet">${n.snippet}</div>
        </div>
      `).join("");
    } else if (activeTab === "upcoming") {
      if (tomorrowItems.length > 0) {
        bodyHTML = `
          <div style="font-size: 0.76rem; font-weight: 700; color: #00f0ff; margin: 4px 0 8px; text-transform: uppercase;">
            <i class="far fa-calendar-star"></i> Phát sóng ngày mai (${dayNames[tomorrowKey]})
          </div>
        ` + tomorrowItems.slice(0, 10).map((m) => `
          <div class="notif-movie-item" onclick="app.openMovieModal('${m.slug}', true); app.closeNotificationCenter();">
            <img class="notif-movie-thumb" src="${m.poster || m.backdrop}" alt="${m.title}" loading="lazy"
                 onerror="this.src='https://phimimg.com/upload/vod/20251229-1/d7f24b91fd95fb7cf353e1369e2318b7.jpg'" />
            <div class="notif-movie-info">
              <div class="notif-movie-title" title="${m.title}">${m.title}</div>
              <div class="notif-movie-meta">
                <span class="notif-badge-new"><i class="fas fa-clock"></i> ${m.airTime || "Sắp chiếu"}</span>
                <span>${(m.genres || []).slice(0, 2).join(", ")}</span>
              </div>
            </div>
            <div class="notif-play-btn" title="Chi tiết">
              <i class="fas fa-chevron-right"></i>
            </div>
          </div>
        `).join("");
      } else {
        bodyHTML = `
          <div style="text-align: center; padding: 30px 16px; color: rgba(255,255,255,0.6);">
            <i class="fas fa-clock" style="font-size: 2rem; color: #00f0ff; margin-bottom: 10px;"></i>
            <p>Đang cập nhật lịch phát sóng cho các ngày tiếp theo.</p>
          </div>
        `;
      }
    }

    flyout.innerHTML = `
      <div class="notif-flyout-header">
        <div class="notif-flyout-title">
          <i class="fas fa-bell"></i>
          <span>Thông Báo Điện Ảnh</span>
        </div>
        <button class="notif-flyout-close" onclick="app.closeNotificationCenter()" title="Đóng">
          <i class="fas fa-xmark"></i>
        </button>
      </div>

      <div class="notif-tabs-bar">
        <button class="notif-tab-btn ${activeTab === "today" ? "active" : ""}" onclick="app.switchNotifTab('today')">
          <i class="fas fa-play-circle"></i> Hôm Nay (${todayItems.length})
        </button>
        <button class="notif-tab-btn ${activeTab === "news" ? "active" : ""}" onclick="app.switchNotifTab('news')">
          <i class="fas fa-newspaper"></i> Tin Tức
        </button>
        <button class="notif-tab-btn ${activeTab === "upcoming" ? "active" : ""}" onclick="app.switchNotifTab('upcoming')">
          <i class="fas fa-calendar-plus"></i> Sắp Chiếu
        </button>
      </div>

      <div class="notif-flyout-content">
        ${bodyHTML}
      </div>

      <div class="notif-flyout-footer">
        <span class="notif-view-all-link" onclick="app.setNavigation('lich-chieu'); app.closeNotificationCenter();">
          <i class="fas fa-calendar-days"></i> Xem toàn bộ lịch chiếu tuần này →
        </span>
      </div>
    `;
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
