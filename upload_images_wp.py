#!/usr/bin/env python3
"""
upload_images_wp.py — Upload all images from preview/img/ to WordPress media library.

Uploads images via WP REST API and outputs a mapping file (image_map.json)
that maps local paths to WordPress URLs.

Usage:
    python upload_images_wp.py --wp-url https://haroboz.com --user admin --password "xxxx"

    # Then rebuild the plugin using the uploaded URLs:
    python build_wp_plugin.py --images-base-url https://haroboz.com/wp-content/uploads/haroboz-img

    # Or use the generated mapping directly:
    python upload_images_wp.py --wp-url https://haroboz.com --user admin --password "xxxx" --apply
"""

import os
import sys
import json
import time
import base64
import argparse
import mimetypes
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


def wp_api_request(wp_url: str, endpoint: str, auth: str, method: str = "GET",
                   data: bytes | None = None, content_type: str | None = None,
                   filename: str | None = None) -> dict:
    """Make a WordPress REST API request."""
    url = f"{wp_url.rstrip('/')}/wp-json/wp/v2/{endpoint}"
    req = Request(url, data=data, method=method)
    req.add_header("Authorization", f"Basic {auth}")

    if content_type:
        req.add_header("Content-Type", content_type)
    if filename:
        req.add_header("Content-Disposition", f'attachment; filename="{filename}"')

    try:
        with urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  HTTP {e.code}: {body[:200]}")
        raise


def check_existing_media(wp_url: str, auth: str, filename: str) -> str | None:
    """Check if an image already exists in WP media library. Returns URL or None."""
    search_name = Path(filename).stem
    try:
        results = wp_api_request(wp_url, f"media?search={search_name}&per_page=5", auth)
        for item in results:
            if item.get("source_url", "").endswith(filename) or \
               Path(item.get("source_url", "")).stem == search_name:
                return item["source_url"]
    except Exception:
        pass
    return None


def upload_image(wp_url: str, auth: str, file_path: Path, filename: str) -> str | None:
    """Upload a single image to WP media library. Returns the URL or None."""
    mime_type = mimetypes.guess_type(str(file_path))[0] or "image/png"

    with open(file_path, "rb") as f:
        image_data = f.read()

    try:
        result = wp_api_request(
            wp_url, "media", auth,
            method="POST",
            data=image_data,
            content_type=mime_type,
            filename=filename,
        )
        return result.get("source_url")
    except Exception as e:
        print(f"  FAILED: {e}")
        return None


def scan_images(img_dir: Path) -> list[tuple[str, Path]]:
    """Scan all images and return (relative_key, full_path) pairs.
    relative_key is like: wetransfer/photo.png
    """
    images = []
    for f in sorted(img_dir.rglob("*")):
        if f.is_file() and f.suffix.lower() in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"):
            rel = f.relative_to(img_dir).as_posix()
            images.append((rel, f))
    return images


def main():
    parser = argparse.ArgumentParser(description="Upload images to WordPress media library")
    parser.add_argument("--wp-url", required=True, help="WordPress site URL (e.g. https://haroboz.com)")
    parser.add_argument("--user", required=True, help="WordPress username")
    parser.add_argument("--password", required=True, help="WordPress application password")
    parser.add_argument("--source", default="preview/img", help="Source image directory (default: preview/img)")
    parser.add_argument("--output", default="image_map.json", help="Output mapping file (default: image_map.json)")
    parser.add_argument("--skip-existing", action="store_true", help="Skip images that already exist in WP")
    parser.add_argument("--dry-run", action="store_true", help="List images without uploading")
    parser.add_argument(
        "--only-used", default=None,
        help="Path to pages.json — only upload images referenced in pages",
    )
    args = parser.parse_args()

    img_dir = Path(args.source)
    if not img_dir.exists():
        print(f"ERROR: Image directory '{img_dir}' not found.")
        sys.exit(1)

    # Build auth header
    auth = base64.b64encode(f"{args.user}:{args.password}".encode()).decode()

    # Scan images
    images = scan_images(img_dir)

    # Filter to only used images if --only-used is provided
    if args.only_used:
        pages_data = json.loads(Path(args.only_used).read_text(encoding="utf-8"))
        used_rels = set()
        for p in pages_data:
            for img_src in p.get("images", []):
                rel = img_src.lstrip("/")
                if rel.startswith("img/"):
                    rel = rel[4:]
                used_rels.add(rel)
        images = [(rel, path) for rel, path in images if rel in used_rels]

    print(f"Found {len(images)} images to process")

    if args.dry_run:
        for rel, path in images:
            size = path.stat().st_size / 1024
            print(f"  {rel} ({size:.0f} KB)")
        total_size = sum(p.stat().st_size for _, p in images) / (1024 * 1024)
        print(f"\nTotal: {len(images)} images, {total_size:.1f} MB")
        return

    # Test connection
    print(f"Testing connection to {args.wp_url}...")
    try:
        wp_api_request(args.wp_url, "media?per_page=1", auth)
        print("  Connection OK")
    except Exception as e:
        print(f"  Connection FAILED: {e}")
        sys.exit(1)

    # Load existing mapping
    mapping = {}
    map_file = Path(args.output)
    if map_file.exists():
        mapping = json.loads(map_file.read_text(encoding="utf-8"))
        print(f"  Loaded {len(mapping)} existing mappings from {map_file}")

    # Upload images
    uploaded = 0
    skipped = 0
    failed = 0

    for i, (rel, path) in enumerate(images, 1):
        local_key = f"/img/{rel}"

        # Skip if already mapped
        if local_key in mapping and mapping[local_key]:
            print(f"  [{i}/{len(images)}] SKIP (mapped) {rel}")
            skipped += 1
            continue

        # Check if exists in WP
        if args.skip_existing:
            existing_url = check_existing_media(args.wp_url, auth, path.name)
            if existing_url:
                print(f"  [{i}/{len(images)}] EXISTS {rel} -> {existing_url}")
                mapping[local_key] = existing_url
                skipped += 1
                continue

        # Upload
        size_kb = path.stat().st_size / 1024
        print(f"  [{i}/{len(images)}] Uploading {rel} ({size_kb:.0f} KB)...", end=" ", flush=True)

        wp_url_result = upload_image(args.wp_url, auth, path, path.name)
        if wp_url_result:
            mapping[local_key] = wp_url_result
            uploaded += 1
            print(f"OK -> {wp_url_result}")
        else:
            failed += 1

        # Save mapping after each upload (in case of interruption)
        map_file.write_text(json.dumps(mapping, indent=2, ensure_ascii=False), encoding="utf-8")

        # Small delay to avoid overwhelming the server
        time.sleep(0.3)

    # Final save
    map_file.write_text(json.dumps(mapping, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nDone! Uploaded: {uploaded}, Skipped: {skipped}, Failed: {failed}")
    print(f"Mapping saved to {map_file}")
    print(f"\nNext steps:")
    print(f"  1. Review {map_file}")
    print(f"  2. Rebuild plugin: python build_wp_plugin.py")
    print(f"  3. In WP admin > Haroboz Site > Images: paste the mappings")


if __name__ == "__main__":
    main()
