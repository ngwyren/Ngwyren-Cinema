/**
 * Ngwyren Cinema - Daily Automated Movie Updater
 * Runs every day at 12:00 AM (00:00 ICT / 17:00 UTC) via GitHub Actions
 * Crawls newly released movies from official CDN API, extracts m3u8 streams & prepends to catalog.
 */

const fs = require('fs');
const path = require('path');

// Resolve path to movies-catalog.js
const catalogPath = path.resolve(__dirname, '../js/movies-catalog.js');

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn(`[WARN] Fetch failed for ${url}: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log('=== NGWYREN CINEMA DAILY AUTO-UPDATE (12:00 AM MIDNIGHT) ===');
  console.log(`Reading catalog from: ${catalogPath}`);

  if (!fs.existsSync(catalogPath)) {
    console.error(`Catalog file not found: ${catalogPath}`);
    process.exit(1);
  }

  const catalogCode = fs.readFileSync(catalogPath, 'utf8');
  const jsonMatch = catalogCode.match(/window\.NGWYREN_FULL_CATALOG\s*=\s*(\[[\s\S]*\]);?/);
  if (!jsonMatch) {
    console.error('Failed to parse window.NGWYREN_FULL_CATALOG JSON');
    process.exit(1);
  }

  const catalog = JSON.parse(jsonMatch[1]);
  console.log(`Current catalog contains: ${catalog.length} movies.`);

  const existingSlugs = new Set(catalog.map((m) => m.slug));
  const newMovies = [];

  // Crawl first 3 pages of newly updated movies (around 30-72 movies)
  const maxPages = 3;
  for (let page = 1; page <= maxPages; page++) {
    console.log(`Checking page ${page}/${maxPages} from phim-moi-cap-nhat...`);
    const listRes = await fetchJson(`https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=${page}`);
    if (!listRes || !Array.isArray(listRes.items)) continue;

    for (const item of listRes.items) {
      if (!item.slug || existingSlugs.has(item.slug)) continue;

      console.log(`  -> New release found: "${item.name}" (${item.slug}). Fetching details...`);
      const detail = await fetchJson(`https://phimapi.com/phim/${item.slug}`);
      if (!detail || !detail.movie) continue;

      const m = detail.movie;

      // Bỏ qua phim quảng cáo, nhà cái, cá cược từ API
      const adKeywords = [
        "quảng cáo", "quang cao", "nhà cái", "cá cược", "cá độ", "đặt cược",
        "tài xỉu", "bắn cá", "nổ hũ", "soi kèo", "kèo bóng", "casino",
        "baccarat", "fb88", "jun88", "shbet", "789bet", "hi88", "new88",
        "okvip", "kubet", "w88", "m88", "188bet", "bk8", "dafabat", "fun88"
      ];
      const checkStr = `${item.name || ''} ${item.slug || ''} ${m.name || ''}`.toLowerCase();
      if (adKeywords.some(kw => checkStr.includes(kw))) {
        console.log(`     [SKIP] Bỏ qua phim quảng cáo/cá cược: "${item.name}".`);
        continue;
      }

      const episodes = [];

      if (Array.isArray(detail.episodes) && detail.episodes[0] && Array.isArray(detail.episodes[0].server_data)) {
        detail.episodes[0].server_data.forEach((ep) => {
          if (ep.link_m3u8) {
            episodes.push({
              name: ep.name || 'Full',
              slug: ep.slug || 'full',
              source: ep.link_m3u8
            });
          }
        });
      }

      // If no valid m3u8 stream was found, skip this entry to ensure high quality
      if (episodes.length === 0) {
        console.log(`     [SKIP] No working m3u8 stream found for "${item.name}".`);
        continue;
      }

      const genres = (m.category || []).map((c) => c.name).filter(Boolean);
      if (genres.length === 0) genres.push('Hành Động', 'Khám Phá');

      const country = (m.country && m.country[0] && m.country[0].name) || 'Quốc Tế';
      const countrySlug = (m.country && m.country[0] && m.country[0].slug) || 'quoc-te';

      const poster = m.poster_url
        ? (m.poster_url.startsWith('http') ? m.poster_url : `https://phimimg.com/${m.poster_url}`)
        : '';
      const backdrop = m.thumb_url
        ? (m.thumb_url.startsWith('http') ? m.thumb_url : `https://phimimg.com/${m.thumb_url}`)
        : poster;

      const formattedMovie = {
        id: `pm-${Date.now()}-${m.slug.slice(0, 10)}`,
        slug: m.slug,
        title: m.name,
        originTitle: m.origin_name || m.name,
        poster: poster,
        backdrop: backdrop,
        type: m.type === 'series' ? 'series' : 'single',
        sectionTags: [
          'moi-cap-nhat',
          'de-cu',
          m.type === 'series' ? 'phim-bo' : 'phim-le',
          countrySlug
        ],
        quality: m.quality || 'FHD',
        language: m.lang || 'Vietsub',
        duration: m.time || (m.type === 'series' ? '45 phút/tập' : '110 phút'),
        episodeCurrent: m.episode_current || 'Full',
        episodeTotal: m.episode_total || '1',
        year: parseInt(m.year) || new Date().getFullYear(),
        rating: 8.5 + (Math.floor(Math.random() * 12) / 10),
        matchScore: 92 + Math.floor(Math.random() * 8),
        country: country,
        countrySlug: countrySlug,
        genres: genres,
        director: (m.director && m.director[0]) || 'Đang cập nhật',
        cast: (m.actor && m.actor.length > 0) ? m.actor.slice(0, 5) : ['Diễn viên nổi tiếng'],
        ambientColors: ['#1c1c1e', '#3a3a3c', '#5a5a60'],
        trailerUrl: m.trailer_url || '',
        link: `https://phimmoiz.one/${m.slug}/`,
        synopsis: (m.content || '')
          .replace(/<[^>]*>/g, '')
          .replace(/cùng\s+(phimmoi|phimmoiz|nguonc|ophim|kkphim)[^.]*\./gi, '')
          .replace(/xem\s+phim\s+tại\s+[^\s,.]+/gi, '')
          .replace(/https?:\/\/[^\s]+/gi, '')
          .trim() || `${m.name} là tác phẩm điện ảnh mới nhất cập nhật năm ${m.year}.`,
        episodes: episodes
      };

      newMovies.push(formattedMovie);
      existingSlugs.add(m.slug);
    }
  }

  if (newMovies.length > 0) {
    console.log(`\nSuccessfully crawled ${newMovies.length} new movies!`);
    const updatedCatalog = [...newMovies, ...catalog];
    fs.writeFileSync(
      catalogPath,
      `window.NGWYREN_FULL_CATALOG = ${JSON.stringify(updatedCatalog)};\n`,
      'utf8'
    );
    console.log(`Catalog updated: now ${updatedCatalog.length} total movies.`);
  } else {
    console.log('\nNo new movies to add. Catalog is already up to date!');
  }
}

main().catch((err) => {
  console.error('[FATAL] Auto-update failed:', err);
  process.exit(1);
});
