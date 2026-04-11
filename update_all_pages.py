#!/usr/bin/env python3
"""
update_all_pages.py — Synchronise navbar et footer sur toutes les pages HTML.

Usage:
    python update_all_pages.py [--source preview/]

Le script :
1. Lit le navbar et footer depuis la homepage (index.html)
2. Parcourt toutes les pages HTML
3. Remplace les anciens <header>...</header> et <footer>...</footer>
4. Recalcule les chemins relatifs (../, ../../) selon la profondeur de chaque page
"""

import re
import argparse
from pathlib import Path


def extract_block(html: str, tag: str) -> str | None:
    """Extract the outermost <tag ...>...</tag> block from HTML."""
    pattern = re.compile(
        rf"(<{tag}[\s>].*?</{tag}>)", re.DOTALL | re.IGNORECASE
    )
    match = pattern.search(html)
    return match.group(1) if match else None


def compute_prefix(rel_path: str) -> str:
    """Compute relative prefix for a file path.
    Examples:
        index.html             -> ""
        pages/contact.html     -> "../"
        pages/boutique/x.html  -> "../../"
    """
    depth = rel_path.count("/")
    if depth == 0:
        return ""
    return "../" * depth


def rebase_paths(html: str, prefix: str, original_prefix: str = "") -> str:
    """Replace path prefixes in href and src attributes.
    Converts absolute-root paths (/css/, /js/, /img/) to relative paths.
    Also handles existing relative paths (../, ../../).
    """
    if not prefix and not original_prefix:
        return html

    # Normalize: first convert any relative ../../../ paths to root-style /
    def to_root(m):
        attr = m.group(1)  # href= or src=
        quote = m.group(2)
        path = m.group(3)
        # Skip external URLs
        if path.startswith(("http://", "https://", "mailto:", "tel:", "javascript:", "#", "data:")):
            return m.group(0)
        return m.group(0)

    # Replace root-relative paths with correct relative prefix
    def fix_root_paths(m):
        attr = m.group(1)
        quote = m.group(2)
        path = m.group(3)
        # Only process root-relative paths starting with /
        if path.startswith("/"):
            new_path = prefix + path.lstrip("/")
            return f'{attr}{quote}{new_path}{quote}'
        return m.group(0)

    # Replace existing relative prefixes (../, ../../) with correct depth
    def fix_relative_paths(m):
        attr = m.group(1)
        quote = m.group(2)
        path = m.group(3)
        # Skip external
        if path.startswith(("http://", "https://", "mailto:", "tel:", "javascript:", "#", "data:")):
            return m.group(0)
        # Skip root-relative
        if path.startswith("/"):
            return m.group(0)
        # Strip existing ../ prefixes to get the base path
        stripped = re.sub(r'^(\.\./)+', '', path)
        if stripped != path:
            # Had relative prefixes — rebase
            new_path = prefix + stripped
            return f'{attr}{quote}{new_path}{quote}'
        return m.group(0)

    pattern = re.compile(r'((?:href|src|action)=)(["\'])([^"\']*)\2')
    html = pattern.sub(fix_root_paths, html)
    html = pattern.sub(fix_relative_paths, html)

    return html


def update_pages(source_dir: str):
    source = Path(source_dir)
    homepage = source / "index.html"

    if not homepage.exists():
        print(f"ERROR: {homepage} not found")
        return

    homepage_html = homepage.read_text(encoding="utf-8")
    header_template = extract_block(homepage_html, "header")
    footer_template = extract_block(homepage_html, "footer")

    if not header_template:
        print("WARNING: No <header> block found in homepage")
    if not footer_template:
        print("WARNING: No <footer> block found in homepage")

    html_files = sorted(source.rglob("*.html"))
    updated = 0
    skipped = 0

    for html_file in html_files:
        rel = html_file.relative_to(source).as_posix()
        content = html_file.read_text(encoding="utf-8")
        original = content
        prefix = compute_prefix(rel)

        if header_template:
            old_header = extract_block(content, "header")
            if old_header:
                new_header = rebase_paths(header_template, prefix)
                content = content.replace(old_header, new_header)

        if footer_template:
            old_footer = extract_block(content, "footer")
            if old_footer:
                new_footer = rebase_paths(footer_template, prefix)
                content = content.replace(old_footer, new_footer)

        if content != original:
            html_file.write_text(content, encoding="utf-8")
            updated += 1
            print(f"  ✓ {rel}")
        else:
            skipped += 1

    print(f"\n✅ Done: {updated} updated, {skipped} unchanged")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Sync navbar/footer across all HTML pages"
    )
    parser.add_argument(
        "--source", default="preview", help="Source directory (default: preview)"
    )
    args = parser.parse_args()
    update_pages(args.source)
