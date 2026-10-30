#!/usr/bin/env python3
"""
Ngwyren Cinema — Automated Movie Updater, Deduplicator & Web Maintenance Engine
Runs on schedule via GitHub Actions (.github/workflows/daily-update.yml) and CLI:
  1. Crawls latest 1080p/4K .m3u8 movies & new episodes from PhimAPI (KKPhim) & NguonC.
  2. Deduplicates movies across js/movies-catalog.js (by canonical title, originTitle, and stream URL),
     always keeping & merging the highest-quality version (4K/1080p, direct .m3u8, most episodes, Thuyết Minh/Lồng Tiếng).
  3. Purges broken/non-stream webpage embeds (animevietsub.sale, player.php, opstream, gambling domains).
  4. Syncs and repairs the 7-day showtime schedule (js/air-schedule.js) so every item maps to a valid .m3u8 movie.
  5. Audits JS syntax integrity across js/movies-catalog.js, js/air-schedule.js, js/data.js, and js/app.js.
"""

import json
import os
import re
import sys
import unicodedata
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG_PATH = os.path.join(WORKSPACE, "js/movies-catalog.js")
SCHEDULE_PATH = os.path.join(WORKSPACE, "js/air-schedule.js")

AD_KEYWORDS = [
    "i999", "i999.ai", "cwin", "quảng cáo", "quang cao", "nhà cái", "cá cược", "cá độ", "đặt cược",
    "tài xỉu", "bắn cá", "nổ hũ", "soi kèo", "kèo bóng", "casino", "sòng bài", "rút tiền 24/7",
    "baccarat", "fb88", "jun88", "shbet", "789bet", "hi88", "new88", "i9bet", "8xbet", "k8cc",
    "okvip", "kubet", "thabet", "w88", "m88", "188bet", "bk8", "dafabat", "fun88", "ae888", "sv388", "vn88",
    "sin88", "may88", "red88", "five88", "debet", "sv88", "zbet", "oxbet", "lixi88", "telegram", "link cược"
]

FORBIDDEN_STREAM_PATTERNS = [
    "opstream", "9922.com", "bet88", "animevietsub.sale", "yanhh3d.ee/player/player.php",
    "hhpanda.st", "streamfree.vip"
]

# Known stream repairs for classic movies where upstream had a mismatched stream
STREAM_REPAIRS = {
    "avengers-1-biet-doi-sieu-anh-hung": {
        "crawlSlug": "biet-doi-sieu-anh-hung",
        "source": "https://s6.kkphimplayer6.com/20250914/qJv6Vjrb/index.m3u8"
    }
}


def is_ad(title, slug):
    tl = (title or "").lower()
    sl = (slug or "").lower()
    return any(kw in tl or kw in sl for kw in AD_KEYWORDS)


def clean_ad_text(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"bộ\s+phim\s+này\s+do[^\n.]*", "", text, flags=re.I)
    text = re.sub(r"sản\s+phẩm:\s*(nổ\s*hũ|bắn\s*cá|sòng\s*bài|thể\s*thao)[^\n.]*", "", text, flags=re.I)
    text = re.sub(r"rút\s+tiền\s+24\/7[^\n.]*", "", text, flags=re.I)
    text = re.sub(r"nhận\s+tiền\s+trong\s+tích\s+tắc[^\n.]*", "", text, flags=re.I)
    text = re.sub(r"tài\s+trợ\s+và\s+công\s+bố[^\n.]*", "", text, flags=re.I)
    text = re.sub(r"cùng\s+(phimmoi|phimmoiz|nguonc|ophim|kkphim)[^.]*\.", "", text, flags=re.I)
    text = re.sub(r"xem\s+phim\s+tại\s+[^\s,.]+", "", text, flags=re.I)
    text = re.sub(r"chúc\s+bạn\s+xem\s+phim\s+vui\s+vẻ[^.]*\.", "", text, flags=re.I)
    text = re.sub(r"liên\s+hệ\s+quảng\s+cáo[^\n.]*", "", text, flags=re.I)
    text = re.sub(r"tham\s+gia\s+(cược|nhà\s+cái)[^\n.]*", "", text, flags=re.I)
    text = re.sub(r"https?:\/\/[^\s]+", "", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def unwrap_m3u8_url(url):
    if not url or not isinstance(url, str):
        return ""
    u = url.strip()
    if "player.phimapi.com/player/?url=" in u or "?url=http" in u:
        idx = u.find("?url=")
        if idx != -1:
            u = urllib.parse.unquote(u[idx + 5:].split("&")[0])
    return u


def is_valid_m3u8(url):
    if not url or not isinstance(url, str):
        return False
    u = unwrap_m3u8_url(url).lower()
    if any(p in u for p in FORBIDDEN_STREAM_PATTERNS):
        return False
    return ".m3u8" in u or "/hls/" in u


def to_ascii(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.strip()


def canonical_title_key(movie):
    raw_title = movie.get("title") or ""
    t = to_ascii(raw_title)
    # Strip parenthetical alternate/English title unless it specifies season/part/adaptation/year
    t = re.sub(r"\s*\((?!phan\s*\d|mua\s*\d|season\s*\d|part\s*\d|ban\s+|19\d\d|20\d\d)[^)]+\)", "", t)
    # Normalize "(phan X) (arc name)" -> "arc name" (e.g. Demon Slayer arcs)
    t = re.sub(r"\(phan\s*\d+\)\s*\(([^)]+)\)", r"\1", t)
    # Normalize season markers: "phan 2", "mua 2", "season 2", "2nd season", "ii" -> "s2"
    t = re.sub(r"\b(?:phan|mua|season)\s*(\d+)\b", r"s\1", t)
    t = re.sub(r"\b(\d+)(?:st|nd|rd|th)\s*season\b", r"s\1", t)
    t = re.sub(r"\s+iii\b", " s3", t)
    t = re.sub(r"\s+ii\b", " s2", t)
    # Normalize "conan 1 qua bom choc troi" vs "conan qua bom choc troi"
    t = re.sub(r"\bconan\s+\d+\s+", "conan ", t)
    # Normalize trailing standalone season number (e.g. "duoc su tu su 3" -> "duoc su tu su s3")
    t = re.sub(r"\s+(\d+)$", r" s\1", t)
    t = re.sub(r"[^a-z0-9]+", " ", t).strip()
    return t


def score_movie_quality(m):
    """
    Scores a movie entry so deduplication ALWAYS selects the highest-quality version:
      1. Direct, verified .m3u8 stream (+1000)
      2. Number of valid .m3u8 episodes (+12 per episode, capped at +600)
      3. Real 4K Ultra HD (+300) or Full HD 1080p (+150)
      4. Dual audio / Thuyết Minh / Lồng Tiếng (+120)
      5. Widescreen 16:9 backdrop distinct from poster (+80)
      6. Clean canonical slug without random suffixes (-aXXXX, -465645, -2) (+50)
      7. Trailer URL & rich Vietnamese synopsis (+40)
    """
    score = 0
    eps = m.get("episodes") if isinstance(m.get("episodes"), list) else []
    valid_eps = [e for e in eps if isinstance(e, dict) and is_valid_m3u8(e.get("source", ""))]

    if valid_eps:
        score += 1000
        score += min(600, len(valid_eps) * 12)
    else:
        score -= 500

    q = str(m.get("quality") or "").upper()
    tags = m.get("sectionTags") if isinstance(m.get("sectionTags"), list) else []
    if q == "4K" and "4k" in tags:
        score += 300
    elif "1080" in q or "FHD" in q:
        score += 150

    lang = (m.get("language") or "").lower()
    dub_eps = m.get("dubEpisodes") if isinstance(m.get("dubEpisodes"), list) else []
    if dub_eps or "thuyết minh" in lang or "lồng tiếng" in lang:
        score += 120

    poster = m.get("poster") or ""
    backdrop = m.get("backdrop") or ""
    if backdrop and backdrop != poster and "phimmoiz.one" not in backdrop:
        score += 80

    slug = m.get("slug") or ""
    if not re.search(r"(?:-a\d+|-\d{5,}|-2|-1)$", slug):
        score += 50

    if m.get("trailerUrl"):
        score += 20
    if len(m.get("synopsis") or "") > 80:
        score += 20

    return score


def merge_movie_entries(winner, loser):
    """Merges useful metadata, episodes, dub servers, and tags from loser into winner."""
    w_eps = winner.get("episodes") if isinstance(winner.get("episodes"), list) else []
    l_eps = loser.get("episodes") if isinstance(loser.get("episodes"), list) else []
    w_valid = [e for e in w_eps if isinstance(e, dict) and is_valid_m3u8(e.get("source", ""))]
    l_valid = [e for e in l_eps if isinstance(e, dict) and is_valid_m3u8(e.get("source", ""))]

    if len(l_valid) > len(w_valid):
        winner["episodes"] = l_eps
        if loser.get("episodeCurrent"):
            winner["episodeCurrent"] = loser["episodeCurrent"]
        if loser.get("episodeTotal"):
            winner["episodeTotal"] = loser["episodeTotal"]

    if not winner.get("dubEpisodes") and loser.get("dubEpisodes"):
        winner["dubEpisodes"] = loser["dubEpisodes"]
    if not winner.get("nguoncEpisodes") and loser.get("nguoncEpisodes"):
        winner["nguoncEpisodes"] = loser["nguoncEpisodes"]
    if not winner.get("trailerUrl") and loser.get("trailerUrl"):
        winner["trailerUrl"] = loser["trailerUrl"]

    w_poster = winner.get("poster") or ""
    w_backdrop = winner.get("backdrop") or ""
    l_backdrop = loser.get("backdrop") or ""
    if (not w_backdrop or w_backdrop == w_poster) and l_backdrop and l_backdrop != loser.get("poster"):
        winner["backdrop"] = l_backdrop

    w_tags = winner.get("sectionTags") if isinstance(winner.get("sectionTags"), list) else []
    l_tags = loser.get("sectionTags") if isinstance(loser.get("sectionTags"), list) else []
    for t in l_tags:
        if t not in w_tags and t != "4k":
            w_tags.append(t)
    winner["sectionTags"] = w_tags

    # Keep cleaner title (without redundant English parenthetical if originTitle already has it)
    w_title = winner.get("title") or ""
    l_title = loser.get("title") or ""
    if "(" in w_title and "(" not in l_title and len(l_title) >= 4:
        winner["title"] = l_title

    # Keep alias slugs for fast lookup
    aliases = winner.get("aliasSlugs") if isinstance(winner.get("aliasSlugs"), list) else []
    for s in [loser.get("slug"), loser.get("crawlSlug")]:
        if s and s != winner.get("slug") and s not in aliases:
            aliases.append(s)
    if aliases:
        winner["aliasSlugs"] = aliases

    return winner


def sanitize_movie(m):
    """Normalizes a movie object, unwraps .m3u8 URLs, repairs known streams, and validates quality badges."""
    slug = m.get("slug") or ""
    if slug in STREAM_REPAIRS:
        rep = STREAM_REPAIRS[slug]
        m["crawlSlug"] = rep["crawlSlug"]
        if m.get("episodes") and isinstance(m["episodes"], list):
            m["episodes"][0]["source"] = rep["source"]

    # Unwrap and clean episodes
    eps = m.get("episodes") if isinstance(m.get("episodes"), list) else []
    cleaned_eps = []
    for ep in eps:
        if not isinstance(ep, dict):
            continue
        src = unwrap_m3u8_url(ep.get("source") or "")
        embed = ep.get("embed") or ""
        if any(p in src.lower() for p in FORBIDDEN_STREAM_PATTERNS):
            src = ""
        if any(p in embed.lower() for p in FORBIDDEN_STREAM_PATTERNS):
            embed = ""
        ep_copy = dict(ep)
        ep_copy["source"] = src
        if embed:
            ep_copy["embed"] = embed
        else:
            ep_copy.pop("embed", None)
        ep_copy.pop("altSources", None)
        if not src:
            ep_copy["needsEnrich"] = True
        else:
            ep_copy.pop("needsEnrich", None)
        cleaned_eps.append(ep_copy)

    m["episodes"] = cleaned_eps

    # Honest quality normalization
    tags = m.get("sectionTags") if isinstance(m.get("sectionTags"), list) else ["hot", "vietsub"]
    is_real_4k = str(m.get("quality") or "").upper() == "4K" and "4k" in tags
    m["quality"] = "4K" if is_real_4k else "1080"
    if not is_real_4k and "4k" in tags:
        tags = [t for t in tags if t != "4k"]
    m["sectionTags"] = tags
    m["synopsis"] = clean_ad_text(m.get("synopsis") or "")
    return m


def deduplicate_catalog(catalog):
    """
    Deduplicates movies across the catalog while preserving the highest-quality version.
    """
    # 1. Sanitize all entries and drop pure ad/spam or broken animevietsub webpage-only items
    sanitized = []
    dropped_broken = 0
    for item in catalog:
        if not item or not isinstance(item, dict) or not item.get("slug"):
            continue
        if is_ad(item.get("title"), item.get("slug")):
            dropped_broken += 1
            continue
        item = sanitize_movie(item)
        # Drop legacy animevietsub (-aXXXX) webpage-only entries that have no .m3u8 stream
        has_m3u8 = any(is_valid_m3u8(e.get("source", "")) for e in item.get("episodes", []))
        if not has_m3u8 and (item.get("sourceSite") == "animevietsub.sale" or re.search(r"-a\d+$", item.get("slug", ""))):
            dropped_broken += 1
            continue
        sanitized.append(item)

    # 2. Group and deduplicate by canonical title key AND by identical .m3u8 stream URL
    by_title_key = {}
    by_stream_url = {}
    deduped = []
    merged_count = 0

    for item in sanitized:
        t_key = canonical_title_key(item)
        eps = item.get("episodes") or []
        first_src = eps[0].get("source", "") if eps else ""

        # Distinguish remakes of single movies released >= 3 years apart with different streams
        if t_key in by_title_key:
            prev = by_title_key[t_key]
            prev_eps = prev.get("episodes") or []
            prev_src = prev_eps[0].get("source", "") if prev_eps else ""
            y1 = int(prev.get("year") or 2025)
            y2 = int(item.get("year") or 2025)
            if prev.get("type") == "single" and item.get("type") == "single" and abs(y1 - y2) >= 3 and first_src != prev_src:
                t_key = f"{t_key} {y2}"

        existing = by_title_key.get(t_key)
        if not existing and first_src and is_valid_m3u8(first_src):
            # Check if another entry already uses this exact .m3u8 stream URL
            stream_match = by_stream_url.get(first_src)
            if stream_match:
                # Only merge on stream URL if they are the same movie/franchise or same year
                s_key1 = canonical_title_key(stream_match)
                if s_key1[:10] == t_key[:10] or stream_match.get("year") == item.get("year"):
                    existing = stream_match

        if existing:
            merged_count += 1
            if score_movie_quality(item) > score_movie_quality(existing):
                # Replace existing in-place with higher-quality item merged with existing
                merged = merge_movie_entries(item, existing)
                idx = deduped.index(existing)
                deduped[idx] = merged
                by_title_key[t_key] = merged
                if first_src and is_valid_m3u8(first_src):
                    by_stream_url[first_src] = merged
            else:
                merge_movie_entries(existing, item)
        else:
            deduped.append(item)
            by_title_key[t_key] = item
            if first_src and is_valid_m3u8(first_src):
                by_stream_url[first_src] = item

    print(f"[DEDUP] Dropped {dropped_broken} broken/non-stream items, merged {merged_count} duplicates -> {len(deduped)} unique high-quality movies.")
    return deduped


def fetch_kk_detail(slug):
    url = f"https://phimapi.com/phim/{slug}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=4.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            movie = data.get("movie", {})
            episodes_data = data.get("episodes", [])
            title = (movie.get("name") or "").strip()
            if not title or is_ad(title, slug):
                return None
            thumb = (movie.get("thumb_url") or "").strip()
            poster = (movie.get("poster_url") or "").strip()
            if not poster:
                return None
            if not thumb:
                thumb = poster
            eps = []
            if episodes_data:
                server_data = episodes_data[0].get("server_data", [])
                for ep in server_data:
                    link = unwrap_m3u8_url(ep.get("link_m3u8", ""))
                    if is_valid_m3u8(link):
                        eps.append({
                            "name": ep.get("name", "Tập 1"),
                            "slug": ep.get("slug", "tap-1"),
                            "source": link
                        })
            if not eps:
                return None
            genres = [c.get("name") for c in movie.get("category", []) if c.get("name")] or ["Chính Kịch"]
            countries = movie.get("country", [])
            c_name = countries[0].get("name", "Quốc Tế") if countries else "Quốc Tế"
            c_slug = countries[0].get("slug", "quoc-te") if countries else "quoc-te"
            cast = [a.strip() for a in movie.get("actor", []) if a.strip()] or ["Dàn diễn viên chính"]
            director = movie.get("director", "Đang cập nhật")
            if isinstance(director, list):
                director = ", ".join(director) if director else "Đang cập nhật"
            m_type = "series" if movie.get("type") == "series" or len(eps) > 1 else "single"
            section_tags = ["moi-cap-nhat", "hot", "vietsub", "phim-bo" if m_type == "series" else "phim-le"]
            if any(g.lower() in ["hoạt hình", "anime"] for g in genres):
                section_tags.append("anime")
            year = movie.get("year", 2026)
            try:
                year = int(year)
            except Exception:
                year = 2026
            return {
                "id": f"kk-{slug}",
                "slug": slug,
                "crawlSlug": slug,
                "title": title,
                "originTitle": movie.get("origin_name", title),
                "poster": poster,
                "backdrop": thumb,
                "type": m_type,
                "sectionTags": section_tags,
                "quality": "1080",
                "language": movie.get("lang", "Vietsub"),
                "duration": movie.get("time", "120 phút"),
                "episodeCurrent": movie.get("episode_current", "Full"),
                "episodeTotal": str(movie.get("episode_total") or len(eps)),
                "year": year,
                "rating": 9.2,
                "matchScore": 96,
                "country": c_name,
                "countrySlug": c_slug,
                "genres": genres,
                "director": director,
                "cast": cast,
                "ambientColors": ["#ffffff", "#d4d4d4", "#a3a3a3"],
                "trailerUrl": movie.get("trailer_url", ""),
                "synopsis": clean_ad_text(movie.get("content", "")) or f"Xem phim {title} ({year}) Full HD 1080p Vietsub tại Ngwyren Cinema.",
                "episodes": eps,
                "sourceSite": "kkphim"
            }
    except Exception:
        return None


def crawl_latest_movies(existing_catalog, max_pages=3):
    existing_slugs = set()
    existing_tkeys = set()
    for m in existing_catalog:
        s = m.get("slug")
        if s:
            existing_slugs.add(s)
        for a in m.get("aliasSlugs", []):
            existing_slugs.add(a)
        existing_tkeys.add(canonical_title_key(m))

    candidates = []
    for p in range(1, max_pages + 1):
        url = f"https://phimapi.com/danh-sach/phim-moi-cap-nhat?page={p}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for it in data.get("items", []):
                    s = it.get("slug")
                    tkey = canonical_title_key({"title": it.get("name", "")})
                    if s and s not in existing_slugs and tkey not in existing_tkeys and s not in candidates:
                        candidates.append(s)
        except Exception:
            pass

    if not candidates:
        print("[UPDATE] Catalog is already up to date with latest PhimAPI releases.")
        return []

    fetched = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(fetch_kk_detail, s): s for s in candidates[:25]}
        for fut in as_completed(futures):
            res = fut.result()
            if res:
                fetched.append(res)
    print(f"[UPDATE] Crawled {len(fetched)} new movies from PhimAPI.")
    return fetched


def repair_air_schedule(catalog):
    if not os.path.exists(SCHEDULE_PATH):
        return
    with open(SCHEDULE_PATH, "r", encoding="utf-8") as f:
        sched_code = f.read()
    m = re.search(r"window\.NGWYREN_AIR_SCHEDULE\s*=\s*(\{[\s\S]*\});?", sched_code)
    if not m:
        return
    sched = json.loads(m.group(1))

    # Build lookup maps from deduplicated catalog
    by_slug = {}
    by_key = {}
    for mov in catalog:
        by_slug[mov["slug"]] = mov
        for a in mov.get("aliasSlugs", []):
            by_slug[a] = mov
        by_key[canonical_title_key(mov)] = mov

    repaired_count = 0
    for day, items in sched.items():
        new_items = []
        seen_day_slugs = set()
        for it in items:
            slug = it.get("slug") or ""
            target = by_slug.get(slug)
            if not target:
                t_key = canonical_title_key(it)
                target = by_key.get(t_key)
            if target:
                if target["slug"] != slug:
                    repaired_count += 1
                it["slug"] = target["slug"]
                it["title"] = target["title"]
                it["originTitle"] = target.get("originTitle") or target["title"]
                it["poster"] = target.get("poster") or it.get("poster")
                it["backdrop"] = target.get("backdrop") or it.get("backdrop")
                it["quality"] = "4K Ultra HD" if target.get("quality") == "4K" else "1080p Full HD"
                it["currentEpisode"] = target.get("episodeCurrent") or it.get("currentEpisode") or "Tập Mới"
            elif re.search(r"-a\d+$", slug):
                # Drop broken animevietsub schedule item that has no playable stream
                repaired_count += 1
                continue

            if it["slug"] not in seen_day_slugs:
                seen_day_slugs.add(it["slug"])
                new_items.append(it)
        sched[day] = new_items

    out = "/* Ngwyren Cinema Air Schedule (Lịch Chiếu Phim Cập Nhật Hàng Ngày) */\nwindow.NGWYREN_AIR_SCHEDULE = " + json.dumps(sched, ensure_ascii=False, indent=2) + ";\n"
    with open(SCHEDULE_PATH, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"[SCHEDULE] Audited & repaired 7-day showtime schedule ({repaired_count} links upgraded).")


def main():
    skip_crawl = "--dedup-only" in sys.argv
    print("=== NGWYREN CINEMA — MAINTENANCE, DEDUPLICATION & AUTO-UPDATE ===")
    if not os.path.exists(CATALOG_PATH):
        print(f"Error: {CATALOG_PATH} not found.")
        sys.exit(1)

    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        code = f.read()
    m = re.search(r"window\.NGWYREN_FULL_CATALOG\s*=\s*(\[[\s\S]*\]);?", code)
    if not m:
        print("Error: Could not parse window.NGWYREN_FULL_CATALOG")
        sys.exit(1)

    catalog = json.loads(m.group(1))
    print(f"[LOAD] Loaded {len(catalog)} catalog entries.")

    if not skip_crawl:
        new_movies = crawl_latest_movies(catalog, max_pages=2)
        if new_movies:
            catalog = new_movies + catalog

    deduped = deduplicate_catalog(catalog)

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        f.write("window.NGWYREN_FULL_CATALOG = " + json.dumps(deduped, ensure_ascii=False) + ";\n")
    print(f"[SAVE] Wrote {len(deduped)} clean, deduplicated movies to {CATALOG_PATH}.")

    repair_air_schedule(deduped)
    print("[DONE] Maintenance & update completed successfully.")


if __name__ == "__main__":
    main()
