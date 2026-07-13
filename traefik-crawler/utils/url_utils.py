"""URL normalization, validation and relevance filters."""

from __future__ import annotations

import re
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

from config import (
    ALWAYS_RELEVANT_DOMAINS,
    SKIP_EXTENSIONS,
    TRAEFIK_KEYWORDS,
)

# Tracking / session query params to strip
_STRIP_PARAMS = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "utm_id",
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid",
        "ref",
        "ref_src",
        "source",
        "si",
        "s",
        "share",
        "spm",
    }
)

_URL_RE = re.compile(
    r"https?://[^\s<>\"'\\)\]]+",
    re.IGNORECASE,
)

_GITHUB_REPO_RE = re.compile(
    r"^https?://github\.com/traefik(/[\w.\-]+)*/?$",
    re.IGNORECASE,
)


def strip_fragment(url: str) -> str:
    parsed = urlparse(url)
    return urlunparse(parsed._replace(fragment=""))


def normalize_url(url: str, base: str | None = None) -> str | None:
    """Return a cleaned absolute URL or None if invalid / discarded."""
    if not url:
        return None

    raw = url.strip()
    if not raw or raw.startswith(("#", "javascript:", "mailto:", "tel:", "data:")):
        return None

    if base:
        raw = urljoin(base, raw)

    raw = strip_fragment(raw)

    try:
        parsed = urlparse(raw)
    except Exception:
        return None

    if parsed.scheme not in ("http", "https"):
        return None
    if not parsed.netloc:
        return None

    # Drop credentials in netloc
    host = parsed.hostname
    if not host:
        return None
    host = host.lower()
    if host.startswith("www."):
        # keep www for some sites; normalize only empty path later
        pass

    path = parsed.path or "/"
    # Collapse multiple slashes except after scheme
    path = re.sub(r"/{2,}", "/", path)

    # Skip binary/static assets by extension
    lower_path = path.lower()
    for ext in SKIP_EXTENSIONS:
        if lower_path.endswith(ext):
            return None

    # Filter query params
    query_pairs = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in _STRIP_PARAMS
    ]
    query = urlencode(query_pairs, doseq=True)

    # Prefer https for known hosts when both exist — keep as-is for uniqueness
    port = parsed.port
    netloc = host
    if port and not ((parsed.scheme == "http" and port == 80) or (parsed.scheme == "https" and port == 443)):
        netloc = f"{host}:{port}"

    # Drop trailing slash except for root
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    normalized = urlunparse((parsed.scheme.lower(), netloc, path, "", query, ""))
    return normalized


def is_valid_url(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.scheme in ("http", "https") and bool(p.netloc)
    except Exception:
        return False


def domain_of(url: str) -> str:
    try:
        host = (urlparse(url).hostname or "").lower()
        return host
    except Exception:
        return ""


def is_always_relevant(url: str) -> bool:
    host = domain_of(url)
    if host in ALWAYS_RELEVANT_DOMAINS:
        return True
    # Subdomains of traefik.io
    if host.endswith(".traefik.io") or host == "traefik.io":
        return True
    if _GITHUB_REPO_RE.match(url) or "github.com/traefik" in url.lower():
        return True
    return False


def text_mentions_traefik(text: str) -> bool:
    if not text:
        return False
    lower = text.lower()
    return any(k in lower for k in TRAEFIK_KEYWORDS)


def is_relevant_url(url: str, page_text: str | None = None) -> bool:
    """Decide if a URL should enter the knowledge corpus."""
    if is_always_relevant(url):
        return True

    lower = url.lower()
    if any(k in lower for k in TRAEFIK_KEYWORDS):
        return True

    # Tag / search pages
    if "tagged/traefik" in lower or "q=traefik" in lower or "/r/traefik" in lower:
        return True

    if page_text and text_mentions_traefik(page_text):
        return True

    return False


def extract_urls_from_text(text: str, base: str | None = None) -> set[str]:
    found: set[str] = set()
    if not text:
        return found
    for match in _URL_RE.findall(text):
        cleaned = match.rstrip(".,;:)]}>\"'")
        norm = normalize_url(cleaned, base=base)
        if norm:
            found.add(norm)
    return found
