#!/usr/bin/env python3
"""
Ngwyren Cinema - Multi-Source Catalog Ingestion & Air Schedule Generator
Sources:
  1. https://yanhh3d.ee/ (Full 3D Donghua catalog, 1080p & 4K, Vietsub & Thuyết Minh, Showtimes taxonomy)
  2. https://animevietsub.sale/ (Top Anime & Donghua, 1080p, Vietsub & Thuyết Minh)
"""

import subprocess
import json
import re
import html
import os
import sys

WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG_PATH = os.path.join(WORKSPACE, "js/movies-catalog.js")
SCHEDULE_PATH = os.path.join(WORKSPACE, "js/air-schedule.js")

CATEGORIES_MAP = {
    15: "Cổ Trang",
    17: "Đô Thị",
    19: "Hài Hước",
    22: "Hiện Đại",
    23: "Kiếm Hiệp",
    24: "Tiên Hiệp",
    21: "Trùng Sinh",
    25: "Tu Tiên",
    1: "Xuyên Không"
}

SHOWTIMES_MAP = {
    5: "thu-2",
    6: "thu-3",
    7: "thu-4",
    8: "thu-5",
    9: "thu-6",
    10: "thu-7",
    4: "chu-nhat"
}

SHOWTIMES_NAME_MAP = {
    "thu-2": "Thứ 2",
    "thu-3": "Thứ 3",
    "thu-4": "Thứ 4",
    "thu-5": "Thứ 5",
    "thu-6": "Thứ 6",
    "thu-7": "Thứ 7",
    "chu-nhat": "Chủ Nhật"
}

AD_KEYWORDS = [
    "quảng cáo", "quang cao", "nhà cái", "cá cược", "cá độ", "đặt cược",
    "tài xỉu", "bắn cá", "nổ hũ", "soi kèo", "kèo bóng", "casino",
    "baccarat", "fb88", "jun88", "shbet", "789bet", "hi88", "new88",
    "okvip", "kubet", "w88", "m88", "188bet", "bk8", "dafabat", "fun88"
]

def clean_text(text):
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    for kw in AD_KEYWORDS:
        text = re.sub(rf'(?i){kw}', '', text)
    text = re.sub(r'https?://[^\s]+', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def curl_json(url, headers=None, timeout=15):
    cmd = ['curl', '-s', '-L', '--max-time', str(timeout)]
    if headers:
        for k, v in headers.items():
            cmd.extend(['-H', f'{k}: {v}'])
    cmd.append(url)
    res = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(res.stdout)
    except Exception:
        return None

def curl_html(url, cookies_file=None, timeout=15):
    cmd = ['curl', '-s', '-L', '--max-time', str(timeout),
           '-A', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36']
    if cookies_file and os.path.exists(cookies_file):
        cmd.extend(['-c', cookies_file, '-b', cookies_file])
    cmd.append(url)
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.stdout

def crawl_yanhh3d_all():
    print(">>> [YANHH3D] Crawling all posts and showtimes from https://yanhh3d.ee/...")
    all_posts = []
    for page in range(1, 10):
        url = f"https://yanhh3d.ee/wp-json/wp/v2/posts?per_page=100&page={page}"
        data = curl_json(url)
        if not data or not isinstance(data, list):
            break
        all_posts.extend(data)
        print(f"    Page {page}: got {len(data)} posts (Total: {len(all_posts)})")
        if len(data) < 100:
            break

    print(f"    [OK] Successfully fetched {len(all_posts)} posts from yanhh3d.ee.")
    return all_posts

def parse_yanhh3d_post(post):
    post_id = post.get("id")
    slug = post.get("slug") or f"yanhh3d-{post_id}"
    raw_title = post.get("title", {}).get("rendered", "")
    title = clean_text(raw_title)

    # Categories to genres
    cat_ids = post.get("categories", [])
    genres = [CATEGORIES_MAP[cid] for cid in cat_ids if cid in CATEGORIES_MAP]
    if not genres:
        genres = ["Hoạt Hình 3D", "Tu Tiên", "Huyền Huyễn"]
    elif "Hoạt Hình 3D" not in genres:
        genres.insert(0, "Hoạt Hình 3D")

    # Showtimes (Lịch chiếu)
    st_ids = post.get("showtimes", [])
    showtime_days = [SHOWTIMES_MAP[sid] for sid in st_ids if sid in SHOWTIMES_MAP]

    # Poster & Backdrop
    og_imgs = post.get("yoast_head_json", {}).get("og_image", [])
    poster = og_imgs[0].get("url") if og_imgs else ""
    if not poster:
        poster = "https://yanhh3d.ee/wp-content/uploads/2025/12/bach-luyen-thanh-than-3-00.jpg"
    backdrop = poster

    # Description
    desc = post.get("yoast_head_json", {}).get("description") or post.get("excerpt", {}).get("rendered", "")
    synopsis = clean_text(desc)
    if not synopsis or len(synopsis) < 20:
        synopsis = f"{title} là bộ phim hoạt hình 3D Trung Quốc đặc sắc thuộc thể loại {', '.join(genres[:3])}, cập nhật trọn bộ chất lượng 1080p và 4K Vietsub kèm Thuyết minh tại Ngwyren Cinema."

    # Air schedule default times for Donghua
    air_times_preset = {
        "thu-2": "10:00 Sáng",
        "thu-3": "10:00 Sáng",
        "thu-4": "11:00 Trưa",
        "thu-5": "10:00 Sáng",
        "thu-6": "18:00 Tối",
        "thu-7": "10:00 Sáng",
        "chu-nhat": "10:00 Sáng"
    }
    air_time = air_times_preset.get(showtime_days[0], "10:00 Sáng") if showtime_days else "10:00 Sáng"

    # Multi-server episode stream configuration
    # Server 1: Vietsub 1080p V1
    # Server 2: Vietsub 1080p V2
    # Server 3: Thuyết Minh 1080p / 4K
    ep_slug = "tap-1"
    watch_link = post.get("link", f"https://yanhh3d.ee/{slug}")
    
    # Check if OVA / single
    is_ova = "ova" in slug or "movie" in slug or "dien-anh" in slug

    # Build primary episodes
    episodes = [
        {
            "name": "Tập 1",
            "slug": "tap-1",
            "source": f"https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id={post_id}&chapter_st=tap-1&type=tiktik&sv=1",
            "embed": f"https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id={post_id}&chapter_st=tap-1&type=tiktik&sv=1",
            "altSources": [
                {
                    "id": "srv-yan-1",
                    "label": "1080p Vietsub V1",
                    "source": f"https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id={post_id}&chapter_st=tap-1&type=tiktik&sv=1",
                    "embed": f"https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id={post_id}&chapter_st=tap-1&type=tiktik&sv=1"
                },
                {
                    "id": "srv-yan-2",
                    "label": "1080p Vietsub V2",
                    "source": f"https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id={post_id}&chapter_st=tap-1&type=pro&sv=1",
                    "embed": f"https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id={post_id}&chapter_st=tap-1&type=pro&sv=1"
                },
                {
                    "id": "srv-yan-3",
                    "label": "4K Thuyết Minh",
                    "source": f"https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id={post_id}&chapter_st=tap-1&type=pro&sv=1",
                    "embed": f"https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id={post_id}&chapter_st=tap-1&type=pro&sv=1"
                }
            ],
            "needsEnrich": True
        }
    ]

    # Dub/Thuyết minh episodes
    dub_episodes = [
        {
            "name": "Tập 1 (Thuyết Minh)",
            "slug": "tap-1-tm",
            "source": f"https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id={post_id}&chapter_st=tap-1&type=pro&sv=1",
            "embed": f"https://yanhh3d.ee/player/player.php?action=dox_ajax_player&post_id={post_id}&chapter_st=tap-1&type=pro&sv=1"
        }
    ]

    section_tags = [
        "anime", "hoat-hinh-3d", "trung-quoc", "de-cu", "vietsub", "thuyet-minh", "4k"
    ]
    if showtime_days:
        section_tags.append("dang-chieu")
        section_tags.extend([f"lich-{d}" for d in showtime_days])

    movie_obj = {
        "id": f"yan-{post_id}",
        "slug": slug,
        "crawlSlug": slug,
        "title": title,
        "originTitle": post.get("yoast_head_json", {}).get("og_title", title).split("Thuyết Minh")[0].strip(),
        "poster": poster,
        "backdrop": backdrop,
        "type": "single" if is_ova else "series",
        "sectionTags": section_tags,
        "quality": "4K / 1080p",
        "language": "Vietsub + Thuyết Minh",
        "duration": "20 phút/tập" if not is_ova else "115 phút",
        "episodeCurrent": "Đang cập nhật" if showtime_days else "Trọn Bộ",
        "episodeTotal": "Tập mới nhất",
        "year": 2026 if "2026" in post.get("date", "") else 2025,
        "rating": 9.6,
        "matchScore": 98,
        "country": "Trung Quốc",
        "countrySlug": "trung-quoc",
        "genres": genres,
        "director": "Đang cập nhật",
        "cast": ["Hoạt Hình 3D Trung Quốc", "Đồ Họa Unreal Engine 5"],
        "ambientColors": ["#16213e", "#0f3460", "#e94560"],
        "trailerUrl": "",
        "link": watch_link,
        "synopsis": synopsis,
        "showtimes": showtime_days,
        "airTime": air_time,
        "episodes": episodes,
        "dubEpisodes": dub_episodes,
        "yanPostId": post_id,
        "sourceSite": "yanhh3d.ee"
    }

    return movie_obj

def crawl_animevietsub_sample():
    print(">>> [ANIMEVsub] Crawling anime from https://animevietsub.sale/...")
    cookies_path = "/tmp/animecookies.txt"
    # Ensure cookie initialized
    curl_html("https://animevietsub.sale/anime-moi/", cookies_path)

    movies = []
    target_urls = [
        "https://animevietsub.sale/anime-moi/",
        "https://animevietsub.sale/anime-moi/trang-2.html",
        "https://animevietsub.sale/hoat-hinh-trung-quoc/",
        "https://animevietsub.sale/bang-xep-hang.html"
    ]

    for url in target_urls:
        html_content = curl_html(url, cookies_path)
        items = re.findall(r'<li[^>]*class=[\'\"][^\'\"]*TPostMv[^\'\"]*[\'\"][^>]*>([\s\S]*?)</li>', html_content)
        print(f"    From {url}: found {len(items)} items")

        for item in items:
            href_m = re.search(r'href=[\'\"]([^\'\"]+)[\'\"]', item)
            title_m = re.search(r'<h[23][^>]*class=[\'\"]Title[^\'\"]*[\'\"][^>]*>([^<]+)</h[23]>|<a[^>]+title=[\'\"]([^\'\"]+)[\'\"]', item)
            img_m = re.search(r'data-src=[\'\"]([^\'\"]+)[\'\"]|src=[\'\"]([^\'\"]+)[\'\"]', item)
            badge_m = re.search(r'class=[\'\"](?:mli-eps|mli-quality)[^\'\"]*[\'\"]>([^<]+)<', item)

            href = href_m.group(1) if href_m else ""
            title = (title_m.group(1) or title_m.group(2)) if title_m else ""
            poster = (img_m.group(1) or img_m.group(2)) if img_m else ""
            badge_raw = badge_m.group(1).strip() if badge_m else "Tập Mới"
            if badge_raw.upper() in ["TẬP", "TẬP MỚI", "TAP"]:
                badge = "Tập Mới"
            elif badge_raw.upper() in ["HOÀN", "FULL", "TRỌN BỘ"]:
                badge = "Trọn Bộ"
            elif badge_raw.upper().startswith("TẬP"):
                badge = "Tập " + badge_raw[3:].strip()
            else:
                badge = badge_raw

            if not href or not title or len(title) < 2:
                continue

            slug_match = re.search(r'/phim/([^/]+)/?', href)
            slug = slug_match.group(1) if slug_match else re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')

            clean_t = clean_text(title)
            custom_backdrop = poster
            custom_synopsis = f"{clean_t} (Bản 4K / 1080p Vietsub + Thuyết Minh)."
            if "kusuriya-no-hitorigoto" in slug:
                custom_backdrop = "https://image.tmdb.org/t/p/original/tKZeL5kDZbOo8ao1szJZuZT0kqO.jpg"
                poster = "https://image.tmdb.org/t/p/original/w3agwUSMpJ4X9t1jGrDtqqRPjDQ.jpg"
                custom_synopsis = "Dược Sư Tự Sự (The Apothecary Diaries) tiếp tục câu chuyện ly kỳ về Miêu Miêu (Maomao) - thiếu nữ am hiểu dược liệu và độc dược làm việc trong hậu cung. Với trí thông minh xuất chúng và sự sắc sảo, cô cùng quan giám thị điển trai Nhâm Thị (Jinshi) tiếp tục vén màn những âm mưu thâm hiểm, những vụ hạ độc bí ẩn và những xung đột chính trị đầy gay cấn nơi cung đình."

            movie_obj = {
                "id": f"avs-{slug}",
                "slug": slug,
                "crawlSlug": slug.replace(re.search(r'-a\d+$', slug).group(0) if re.search(r'-a\d+$', slug) else '', ''),
                "title": clean_t,
                "originTitle": clean_t,
                "poster": poster,
                "backdrop": custom_backdrop,
                "type": "series",
                "sectionTags": ["anime", "moi-cap-nhat", "de-cu", "vietsub", "1080p"],
                "quality": "4K / 1080p",
                "language": "Vietsub + Thuyết Minh",
                "duration": "24 phút/tập",
                "episodeCurrent": badge or "Tập Mới",
                "episodeTotal": "Đang phát sóng",
                "year": 2026,
                "rating": 9.5,
                "matchScore": 97,
                "country": "Nhật Bản" if "hoat-hinh-trung-quoc" not in url else "Trung Quốc",
                "countrySlug": "nhat-ban" if "hoat-hinh-trung-quoc" not in url else "trung-quoc",
                "genres": ["Anime", "Hành Động", "Phiêu Lưu", "Kỳ Ảo"],
                "director": "Đang cập nhật",
                "cast": ["Diễn viên lồng tiếng hàng đầu"],
                "ambientColors": ["#1b1a2f", "#2b2a4c", "#e74c3c"],
                "trailerUrl": "",
                "link": href,
                "synopsis": custom_synopsis,
                "episodes": [
                    {
                        "name": badge or "Tập Mới",
                        "slug": "tap-moi",
                        "source": "",
                        "embed": href,
                        "altSources": [
                            {"id": "avs-du", "label": "Server 1 (DU Fast)", "source": "", "embed": href},
                            {"id": "avs-vip", "label": "Server 2 (VIP 1080p)", "source": "", "embed": href},
                            {"id": "avs-tm", "label": "Server Thuyết Minh", "source": "", "embed": href}
                        ],
                        "needsEnrich": True
                    }
                ],
                "sourceSite": "animevietsub.sale"
            }
            movies.append(movie_obj)

    # Deduplicate by slug
    seen = set()
    deduped = []
    for m in movies:
        if m["slug"] not in seen:
            seen.add(m["slug"])
            deduped.append(m)

    print(f"    [OK] Extracted {len(deduped)} anime from animevietsub.sale.")
    return deduped

def build_air_schedule(yan_movies, avs_movies):
    print(">>> [SCHEDULE] Building 7-Day Air Schedule (Lịch Chiếu Phim)...")
    schedule = {
        "thu-2": [],
        "thu-3": [],
        "thu-4": [],
        "thu-5": [],
        "thu-6": [],
        "thu-7": [],
        "chu-nhat": []
    }

    # 1. Fill schedule from yanhh3d taxonomy showtimes
    for m in yan_movies:
        for day in m.get("showtimes", []):
            if day in schedule:
                schedule[day].append({
                    "slug": m["slug"],
                    "title": m["title"],
                    "originTitle": m["originTitle"],
                    "poster": m["poster"],
                    "backdrop": m["backdrop"],
                    "quality": "4K / 1080p",
                    "language": "Vietsub + Thuyết Minh",
                    "airTime": m["airTime"],
                    "genres": m["genres"][:3],
                    "currentEpisode": m["episodeCurrent"],
                    "country": m["country"],
                    "rating": m["rating"],
                    "source": "yanhh3d"
                })

    # 2. Add airing Anime from animevietsub to ensure rich weekly schedule
    anime_day_distribution = {
        "thu-2": ["Dược Sư Tự Sự", "Thương Nguyên Đồ"],
        "thu-3": ["Võ Thượng Thần Đế", "Sora wa Akai Kawa no Hotori"],
        "thu-4": ["Đấu La Đại Lục 2: Tuyệt Thế Đường Môn", "Nghịch Thiên Chí Tôn"],
        "thu-5": ["Đại Chúa Tể", "Linh Võ Đại Lục"],
        "thu-6": ["Bắt Đầu Với Chí Tôn Đan Điền", "Thám Tử Lừng Danh Conan"],
        "thu-7": ["Solo Leveling Phần 2", "Chuyển Sinh Thành Kiếm 2"],
        "chu-nhat": ["One Piece", "Thế Giới Hoàn Mỹ"]
    }

    for day, titles in anime_day_distribution.items():
        for t in titles:
            found = next((x for x in avs_movies if t.lower() in x["title"].lower()), None)
            if found and not any(x["slug"] == found["slug"] for x in schedule[day]):
                schedule[day].append({
                    "slug": found["slug"],
                    "title": found["title"],
                    "originTitle": found["originTitle"],
                    "poster": found["poster"],
                    "backdrop": found["backdrop"],
                    "quality": "1080p Full HD",
                    "language": "Vietsub + Thuyết Minh",
                    "airTime": "18:00 Tối",
                    "genres": found["genres"][:3],
                    "currentEpisode": found["episodeCurrent"],
                    "country": found["country"],
                    "rating": found["rating"],
                    "source": "animevietsub"
                })

    for day, items in schedule.items():
        print(f"    {SHOWTIMES_NAME_MAP[day]}: {len(items)} series scheduled")

    return schedule

def main():
    print("==================================================================")
    print("  NGWYREN CINEMA - CRAWL & INGESTION ENGINE")
    print("  yanhh3d.ee + animevietsub.sale -> movies-catalog.js & air-schedule.js")
    print("==================================================================")

    # 1. Crawl yanhh3d
    yan_posts = crawl_yanhh3d_all()
    yan_movies = [parse_yanhh3d_post(p) for p in yan_posts]

    # 2. Crawl animevietsub
    avs_movies = crawl_animevietsub_sample()

    # 3. Build Air Schedule
    schedule = build_air_schedule(yan_movies, avs_movies)

    # Write Air Schedule file (js/air-schedule.js)
    schedule_code = f"/* Ngwyren Cinema Air Schedule (Lịch Chiếu Phim Cập Nhật Hàng Ngày) */\nwindow.NGWYREN_AIR_SCHEDULE = {json.dumps(schedule, ensure_ascii=False, indent=2)};\n"
    with open(SCHEDULE_PATH, "w", encoding="utf-8") as f:
        f.write(schedule_code)
    print(f"\n[OK] Saved Lịch Chiếu to: {SCHEDULE_PATH}")

    # 4. Merge into existing movies-catalog.js
    if os.path.exists(CATALOG_PATH):
        with open(CATALOG_PATH, "r", encoding="utf-8") as f:
            code = f.read()
        m = re.search(r'window\.NGWYREN_FULL_CATALOG\s*=\s*(\[[\s\S]*\]);?', code)
        existing_catalog = json.loads(m.group(1)) if m else []
        print(f"\nExisting catalog has: {len(existing_catalog)} movies.")
    else:
        existing_catalog = []

    existing_slugs = set(x.get("slug") for x in existing_catalog)
    new_movies = []

    # Prepend YanHH3D movies
    for y in yan_movies:
        if y["slug"] not in existing_slugs:
            new_movies.append(y)
            existing_slugs.add(y["slug"])

    # Prepend AnimeVietSub movies
    for a in avs_movies:
        if a["slug"] not in existing_slugs:
            new_movies.append(a)
            existing_slugs.add(a["slug"])

    print(f"New unique movies added from yanhh3d + animevietsub: {len(new_movies)}")
    full_catalog = new_movies + existing_catalog
    print(f"Total movies in updated catalog: {len(full_catalog)}")

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        f.write(f"window.NGWYREN_FULL_CATALOG = {json.dumps(full_catalog, ensure_ascii=False)};\n")
    print(f"[OK] Saved updated catalog to: {CATALOG_PATH}")

if __name__ == "__main__":
    main()
