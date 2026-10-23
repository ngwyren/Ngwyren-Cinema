#!/usr/bin/env python3
"""
Ngwyren Cinema - High-Resolution Backdrop & Poster Enrichment (Fast Parallel Version)
Finds and upgrades all low-res / blurry backdrops (from animevietsub and yanhh3d)
to official 1080p widescreen horizontal backdrops from PhimAPI / phimimg.com.
"""

import json
import urllib.request
import urllib.parse
import re
import os
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed

WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG_PATH = os.path.join(WORKSPACE, "js/movies-catalog.js")

def remove_accents(input_str):
    if not input_str:
        return ""
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)]).replace('đ', 'd').replace('Đ', 'D')

def clean_base_title(title):
    norm = remove_accents(title).lower()
    base = re.sub(r'\s*[\(\[].*?[\)\]]', '', norm).strip()
    base = re.sub(r'\s*(phần|season|ss|tập|ova|movie)\s*\d+.*', '', base, flags=re.I).strip()
    return base

def search_phimapi(keyword):
    if not keyword or len(keyword) < 2:
        return None
    url = f"https://phimapi.com/v1/api/tim-kiem?keyword={urllib.parse.quote(keyword)}&limit=3"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            items = data.get('data', {}).get('items', [])
            return items
    except Exception:
        return None

def fetch_best_thumb(movie):
    mid = movie.get('id', '')
    title = movie.get('title', '').strip()
    base = clean_base_title(title)
    norm = remove_accents(title).lower()

    # Search in order of specificity
    queries = [title]
    if base and base != norm:
        queries.append(base)
    if norm and norm != title:
        queries.append(norm)

    for q in queries:
        items = search_phimapi(q)
        if items:
            for item in items:
                thumb = item.get('thumb_url')
                poster = item.get('poster_url')
                if thumb and 'phimimg.com' in thumb:
                    return mid, thumb, poster
    return mid, None, None

def main():
    print(">>> Reading catalog from:", CATALOG_PATH)
    with open(CATALOG_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    prefix = "window.NGWYREN_FULL_CATALOG = "
    if not content.startswith(prefix):
        print("[ERROR] Invalid catalog format")
        return

    json_str = content[len(prefix):].rstrip().rstrip(';')
    movies = json.loads(json_str)
    print(f">>> Total movies in catalog: {len(movies)}")

    # 1. Known manual fixes
    known_fixes = {
        "avs-kikansha-no-mahou-wa-tokubetsu-desu-2nd-season-a6076": {
            "backdrop": "https://phimimg.com/uploads/movies/20261009/ma-thuat-dac-biet-cua-phu-thuy-quay-nguoc-thoi-gian-phan-2-thumb.webp",
            "poster": "https://phimimg.com/uploads/movies/20261009/ma-thuat-dac-biet-cua-phu-thuy-quay-nguoc-thoi-gian-phan-2-poster.webp"
        }
    }

    # 2. Build high-res index
    high_res_map = {}
    for m in movies:
        thumb = m.get('backdrop', '')
        poster = m.get('poster', '')
        title = m.get('title', '').strip()
        origin = m.get('originTitle', '').strip()

        if thumb and 'phimimg.com' in thumb and 'thumb' in thumb:
            high_res_map[title.lower()] = (thumb, poster)
            high_res_map[origin.lower()] = (thumb, poster)
            norm = remove_accents(title).lower()
            high_res_map[norm] = (thumb, poster)
            base = clean_base_title(title)
            if len(base) > 3 and base not in high_res_map:
                high_res_map[base] = (thumb, poster)

    print(f">>> Built high-res index with {len(high_res_map)} keys.")

    updated_count = 0
    needs_api_fetch = []

    # 3. Local matching first
    for m in movies:
        mid = m.get('id', '')
        title = m.get('title', '').strip()
        backdrop = m.get('backdrop', '')
        poster = m.get('poster', '')

        if mid in known_fixes:
            m['backdrop'] = known_fixes[mid]['backdrop']
            m['poster'] = known_fixes[mid]['poster']
            updated_count += 1
            continue

        is_avs = 'animevietsub' in backdrop or 'animevietsub' in poster
        is_yan = 'yanhh3d' in backdrop
        is_same = (poster == backdrop and 'thumb' not in backdrop)

        if not (is_avs or is_yan or is_same):
            continue

        t_low = title.lower()
        norm = remove_accents(title).lower()
        base = clean_base_title(title)

        matched = high_res_map.get(t_low) or high_res_map.get(norm) or high_res_map.get(base)
        if matched and matched[0] != backdrop:
            m['backdrop'] = matched[0]
            if is_avs and matched[1] and 'phimimg.com' in matched[1]:
                m['poster'] = matched[1]
            updated_count += 1
            print(f"[LOCAL MATCH] {title} -> {matched[0]}")
        else:
            needs_api_fetch.append(m)

    print(f">>> Local matches applied: {updated_count}. Starting parallel API lookup for {len(needs_api_fetch)} items...")

    # 4. Parallel API lookup for remaining items
    mid_to_movie = {m['id']: m for m in movies}

    with ThreadPoolExecutor(max_workers=16) as executor:
        futures = {executor.submit(fetch_best_thumb, m): m for m in needs_api_fetch}
        for future in as_completed(futures):
            try:
                mid, thumb, poster = future.result()
                if thumb and mid in mid_to_movie:
                    target = mid_to_movie[mid]
                    target['backdrop'] = thumb
                    if poster and 'animevietsub' in target.get('poster', ''):
                        target['poster'] = poster
                    updated_count += 1
                    print(f"[API MATCH] {target['title']} -> {thumb}")
            except Exception as e:
                pass

    print(f"\n>>> Total movies updated with crisp high-res backdrops: {updated_count}")

    # Write back to file
    with open(CATALOG_PATH, 'w', encoding='utf-8') as f:
        f.write(prefix + json.dumps(movies, ensure_ascii=False) + ";\n")

    print("[SUCCESS] js/movies-catalog.js has been saved.")

if __name__ == "__main__":
    main()
