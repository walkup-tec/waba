"""Configuration for the Traefik knowledge crawler."""

from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------------------
# Limits & runtime
# ---------------------------------------------------------------------------
MAX_URLS = 50_000
CHECKPOINT_EVERY = 500
REQUEST_TIMEOUT = 25
CONNECT_TIMEOUT = 10
MAX_CONCURRENCY = 24
MAX_RETRIES = 3
RETRY_WAIT_MIN = 1.0
RETRY_WAIT_MAX = 8.0
USER_AGENT_FALLBACK = (
    "Mozilla/5.0 (compatible; TraefikKnowledgeCrawler/1.0; +https://traefik.io/)"
)

# Crawl depth / breadth controls
MAX_DEPTH = 6
MAX_PAGES_PER_DOMAIN = 8_000
SAME_HOST_PRIORITY = True

# Output paths (relative to project root)
PROJECT_ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = PROJECT_ROOT / "output"
DATA_DIR = PROJECT_ROOT / "data"
# Canonical deliverable: urls.txt at project root
URLS_FILE = PROJECT_ROOT / "urls.txt"
CHECKPOINT_FILE = DATA_DIR / "checkpoint.json"
SEEN_FILE = DATA_DIR / "seen_urls.txt"
QUEUE_FILE = DATA_DIR / "queue.txt"
LOG_FILE = OUTPUT_DIR / "crawler.log"
STATS_FILE = OUTPUT_DIR / "stats.json"

# ---------------------------------------------------------------------------
# Seed URLs (mandatory starting points)
# ---------------------------------------------------------------------------
SEED_URLS: list[str] = [
    "https://doc.traefik.io/",
    "https://traefik.io/",
    "https://community.traefik.io/",
    "https://blog.traefik.io/",
    "https://plugins.traefik.io/",
    "https://github.com/traefik",
    "https://github.com/traefik/traefik",
    "https://github.com/traefik/traefik/issues",
    "https://github.com/traefik/traefik/discussions",
    "https://github.com/traefik/traefik/wiki",
    "https://hub.docker.com/_/traefik",
    "https://artifacthub.io/",
    "https://stackoverflow.com/questions/tagged/traefik",
    "https://serverfault.com",
    "https://superuser.com",
    "https://reddit.com/r/Traefik",
    "https://reddit.com/r/selfhosted",
    "https://dev.to",
    "https://medium.com",
    "https://hashicorp.com",
    "https://developer.hashicorp.com",
    "https://docs.docker.com",
    "https://kubernetes.io",
    "https://helm.sh",
    "https://letsencrypt.org",
    "https://developers.cloudflare.com",
    "https://authelia.com",
    "https://goauthentik.io",
    "https://crowdsec.net",
    "https://grafana.com",
    "https://prometheus.io",
    "https://opentelemetry.io",
    "https://linuxhandbook.com",
    "https://computingforgeeks.com",
    "https://digitalocean.com",
    "https://linode.com",
    "https://vultr.com",
    "https://phoenixnap.com",
    "https://baeldung.com",
]

# ---------------------------------------------------------------------------
# Search queries (used to expand discovery via search engines / site search)
# ---------------------------------------------------------------------------
SEARCH_QUERIES: list[str] = [
    "Traefik",
    "Traefik Proxy",
    "Traefik Docker",
    "Traefik Kubernetes",
    "Traefik Swarm",
    "Traefik Middleware",
    "Traefik TLS",
    "Traefik TCP",
    "Traefik UDP",
    "Traefik HTTP3",
    "Traefik QUIC",
    "Traefik ForwardAuth",
    "Traefik OAuth",
    "Traefik JWT",
    "Traefik ACME",
    "Traefik Lets Encrypt",
    "Traefik mTLS",
    "Traefik Plugins",
    "Traefik Metrics",
    "Traefik Prometheus",
    "Traefik Grafana",
    "Traefik Loki",
    "Traefik Jaeger",
    "Traefik OpenTelemetry",
    "Traefik Authentik",
    "Traefik Authelia",
    "Traefik CrowdSec",
    "Traefik Docker Compose",
    "Traefik Docker Swarm",
    "Traefik K3S",
    "Traefik Rancher",
    "Traefik Nomad",
    "Traefik Consul",
    "Traefik ECS",
    "Traefik Gateway API",
]

# Sites where a page is accepted only if it mentions Traefik (or is a seed host)
TRAEFIK_KEYWORDS: tuple[str, ...] = (
    "traefik",
    "containous",
    "traefikee",
)

# Domains always considered Traefik-relevant (accept all crawlable URLs)
ALWAYS_RELEVANT_DOMAINS: frozenset[str] = frozenset(
    {
        "doc.traefik.io",
        "traefik.io",
        "www.traefik.io",
        "community.traefik.io",
        "blog.traefik.io",
        "plugins.traefik.io",
        "info.traefik.io",
        "hub.traefik.io",
    }
)

# Domains worth crawling deeply when content matches Traefik keywords
PRIORITY_DOMAINS: frozenset[str] = frozenset(
    {
        "doc.traefik.io",
        "traefik.io",
        "www.traefik.io",
        "community.traefik.io",
        "blog.traefik.io",
        "plugins.traefik.io",
        "github.com",
        "raw.githubusercontent.com",
        "gist.github.com",
        "hub.docker.com",
        "artifacthub.io",
        "stackoverflow.com",
        "serverfault.com",
        "superuser.com",
        "reddit.com",
        "www.reddit.com",
        "old.reddit.com",
        "dev.to",
        "medium.com",
        "hashicorp.com",
        "www.hashicorp.com",
        "developer.hashicorp.com",
        "docs.docker.com",
        "kubernetes.io",
        "helm.sh",
        "letsencrypt.org",
        "developers.cloudflare.com",
        "authelia.com",
        "www.authelia.com",
        "goauthentik.io",
        "docs.goauthentik.io",
        "crowdsec.net",
        "docs.crowdsec.net",
        "grafana.com",
        "prometheus.io",
        "opentelemetry.io",
        "linuxhandbook.com",
        "computingforgeeks.com",
        "digitalocean.com",
        "www.digitalocean.com",
        "linode.com",
        "www.linode.com",
        "vultr.com",
        "www.vultr.com",
        "phoenixnap.com",
        "baeldung.com",
        "www.baeldung.com",
    }
)

# Skip heavy / non-document assets
SKIP_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".svg",
        ".webp",
        ".ico",
        ".css",
        ".js",
        ".map",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
        ".mp4",
        ".mp3",
        ".avi",
        ".mov",
        ".zip",
        ".tar",
        ".gz",
        ".tgz",
        ".rar",
        ".7z",
        ".exe",
        ".dmg",
        ".pkg",
        ".deb",
        ".rpm",
        ".pdf",  # binary; skip body crawl but can keep URL if linked — we skip fetch
    }
)

# Content-types we parse for link extraction
PARSEABLE_CONTENT_TYPES: tuple[str, ...] = (
    "text/html",
    "application/xhtml",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "application/json",
    "application/xml",
    "text/xml",
    "application/rss+xml",
    "application/atom+xml",
)

# DuckDuckGo HTML search (no API key)
DDG_SEARCH_URL = "https://html.duckduckgo.com/html/"

# Extra discovery seeds built from search (site: operators)
SEARCH_SITE_TARGETS: list[str] = [
    "doc.traefik.io",
    "traefik.io",
    "community.traefik.io",
    "blog.traefik.io",
    "plugins.traefik.io",
    "github.com/traefik",
    "stackoverflow.com",
    "serverfault.com",
    "reddit.com/r/Traefik",
    "dev.to",
    "medium.com",
    "docs.docker.com",
    "kubernetes.io",
    "helm.sh",
    "developer.hashicorp.com",
    "authelia.com",
    "goauthentik.io",
    "crowdsec.net",
    "grafana.com",
    "digitalocean.com",
    "baeldung.com",
    "linuxhandbook.com",
    "computingforgeeks.com",
]
