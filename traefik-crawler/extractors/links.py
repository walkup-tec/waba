"""Link extractors for HTML, XML, Markdown, JSON and plain text."""

from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from typing import Iterable
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from utils.url_utils import extract_urls_from_text, normalize_url

_MD_LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
_MD_AUTOLINK_RE = re.compile(r"<(https?://[^>]+)>")
_SITEMAP_LOC_RE = re.compile(r"<loc>\s*([^<]+)\s*</loc>", re.IGNORECASE)


def extract_from_html(html: str, base_url: str) -> set[str]:
    urls: set[str] = set()
    if not html:
        return urls

    soup = BeautifulSoup(html, "lxml")

    for tag in soup.find_all(["a", "link", "area"]):
        href = tag.get("href")
        if href:
            n = normalize_url(href, base=base_url)
            if n:
                urls.add(n)

    for tag in soup.find_all(["iframe", "frame"]):
        src = tag.get("src")
        if src:
            n = normalize_url(src, base=base_url)
            if n:
                urls.add(n)

    # Canonical / alternate
    for tag in soup.find_all("link", rel=True):
        rel = " ".join(tag.get("rel") or []).lower()
        if "canonical" in rel or "alternate" in rel:
            href = tag.get("href")
            if href:
                n = normalize_url(href, base=base_url)
                if n:
                    urls.add(n)

    # Meta refresh
    for tag in soup.find_all("meta", attrs={"http-equiv": True}):
        if str(tag.get("http-equiv", "")).lower() == "refresh":
            content = tag.get("content") or ""
            if "url=" in content.lower():
                part = content.split("=", 1)[-1].strip().strip("'\"")
                n = normalize_url(part, base=base_url)
                if n:
                    urls.add(n)

    # Pagination hints (rel=next)
    for tag in soup.find_all("a", rel=True):
        rel = " ".join(tag.get("rel") or []).lower()
        if "next" in rel or "prev" in rel:
            href = tag.get("href")
            if href:
                n = normalize_url(href, base=base_url)
                if n:
                    urls.add(n)

    # Discourse / forum data attributes often hold topic URLs
    for tag in soup.find_all(attrs={"data-topic-url": True}):
        n = normalize_url(tag["data-topic-url"], base=base_url)
        if n:
            urls.add(n)

    # Raw URLs in script/text
    urls |= extract_urls_from_text(soup.get_text(" ", strip=True), base=base_url)

    return urls


def extract_from_markdown(text: str, base_url: str | None = None) -> set[str]:
    urls: set[str] = set()
    if not text:
        return urls

    for match in _MD_LINK_RE.finditer(text):
        n = normalize_url(match.group(2).strip(), base=base_url)
        if n:
            urls.add(n)

    for match in _MD_AUTOLINK_RE.finditer(text):
        n = normalize_url(match.group(1).strip(), base=base_url)
        if n:
            urls.add(n)

    urls |= extract_urls_from_text(text, base=base_url)
    return urls


def extract_from_sitemap_xml(content: str, base_url: str | None = None) -> set[str]:
    urls: set[str] = set()
    if not content:
        return urls

    # Fast path regex (handles large sitemaps / namespaces)
    for loc in _SITEMAP_LOC_RE.findall(content):
        n = normalize_url(loc.strip(), base=base_url)
        if n:
            urls.add(n)

    # Also try ElementTree for nested sitemap indexes
    try:
        root = ET.fromstring(content)
        for el in root.iter():
            tag = el.tag.split("}")[-1].lower() if "}" in el.tag else el.tag.lower()
            if tag == "loc" and el.text:
                n = normalize_url(el.text.strip(), base=base_url)
                if n:
                    urls.add(n)
    except ET.ParseError:
        pass

    return urls


def extract_from_robots(text: str, base_url: str) -> set[str]:
    """Extract Sitemap: directives from robots.txt."""
    urls: set[str] = set()
    if not text:
        return urls
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.lower().startswith("sitemap:"):
            sm = line.split(":", 1)[1].strip()
            n = normalize_url(sm, base=base_url)
            if n:
                urls.add(n)
    return urls


def extract_from_json(text: str, base_url: str | None = None) -> set[str]:
    urls: set[str] = set()
    if not text:
        return urls
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return extract_urls_from_text(text, base=base_url)

    def walk(obj: object) -> None:
        if isinstance(obj, str):
            if obj.startswith("http://") or obj.startswith("https://") or obj.startswith("/"):
                n = normalize_url(obj, base=base_url)
                if n:
                    urls.add(n)
            else:
                urls.update(extract_urls_from_text(obj, base=base_url))
        elif isinstance(obj, dict):
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)

    walk(data)
    return urls


def extract_all(content: str, content_type: str, base_url: str) -> set[str]:
    """Dispatch extractor by content-type / heuristics."""
    ct = (content_type or "").lower()
    urls: set[str] = set()

    if "xml" in ct or base_url.rstrip("/").endswith(".xml") or "<urlset" in content[:2000].lower() or "<sitemapindex" in content[:2000].lower():
        urls |= extract_from_sitemap_xml(content, base_url)

    if "json" in ct:
        urls |= extract_from_json(content, base_url)

    if "markdown" in ct or base_url.endswith(".md"):
        urls |= extract_from_markdown(content, base_url)

    if "html" in ct or "<html" in content[:1500].lower() or "<!doctype" in content[:1500].lower():
        urls |= extract_from_html(content, base_url)
    else:
        # Plain text / README / wiki
        urls |= extract_from_markdown(content, base_url)
        urls |= extract_urls_from_text(content, base_url)

    if base_url.rstrip("/").endswith("robots.txt") or "robots.txt" in base_url:
        urls |= extract_from_robots(content, base_url)

    return urls


def guess_robots_and_sitemap(base_url: str) -> Iterable[str]:
    """Yield standard discovery URLs for a host."""
    from urllib.parse import urlparse

    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    yield f"{origin}/robots.txt"
    yield f"{origin}/sitemap.xml"
    yield f"{origin}/sitemap_index.xml"
    yield f"{origin}/sitemap-index.xml"
