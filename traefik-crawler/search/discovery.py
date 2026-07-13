"""Search-based URL discovery (DuckDuckGo HTML + site-specific seeds)."""

from __future__ import annotations

import logging
from urllib.parse import quote_plus, urlencode

from bs4 import BeautifulSoup

from config import DDG_SEARCH_URL, SEARCH_QUERIES, SEARCH_SITE_TARGETS
from http_client import HttpClient
from utils.url_utils import normalize_url

logger = logging.getLogger("traefik_crawler")


def build_search_queries() -> list[str]:
    """Expand base queries with site: filters for better coverage."""
    queries: list[str] = []
    seen: set[str] = set()

    def add(q: str) -> None:
        q = q.strip()
        if q and q not in seen:
            seen.add(q)
            queries.append(q)

    for q in SEARCH_QUERIES:
        add(q)
        add(f"{q} documentation")
        add(f"{q} tutorial")
        add(f"{q} example")
        add(f"{q} configuration")

    # High-value site-scoped queries
    core = [
        "Traefik",
        "Traefik Proxy",
        "Traefik Docker",
        "Traefik Kubernetes",
        "Traefik Middleware",
        "Traefik ACME",
        "Traefik ForwardAuth",
        "Traefik Gateway API",
    ]
    for site in SEARCH_SITE_TARGETS:
        for term in core:
            add(f"site:{site} {term}")

    # Stack Exchange tags / GitHub
    add("site:stackoverflow.com/questions/tagged/traefik")
    add("site:serverfault.com traefik")
    add("site:superuser.com traefik")
    add("site:github.com/traefik")
    add("site:hub.docker.com traefik")
    add("site:artifacthub.io traefik")
    add("site:reddit.com/r/Traefik")
    add("site:reddit.com/r/selfhosted traefik")

    return queries


async def search_duckduckgo(client: HttpClient, query: str, max_results: int = 40) -> set[str]:
    """Scrape DuckDuckGo HTML results for a query."""
    urls: set[str] = set()
    # GET form works more reliably for some regions
    get_url = f"{DDG_SEARCH_URL}?{urlencode({'q': query})}"
    result = await client.fetch(get_url)
    if not result.ok:
        # Fallback POST
        result = await client.fetch(DDG_SEARCH_URL, method="POST", data={"q": query, "b": ""})
    if not result.ok or not result.content:
        logger.debug("DDG search failed for %r: %s", query, result.error or result.status)
        return urls

    soup = BeautifulSoup(result.content, "lxml")
    for a in soup.select("a.result__a, a.result-link, a[href]"):
        href = a.get("href") or ""
        # DDG sometimes wraps redirects
        if "uddg=" in href:
            from urllib.parse import parse_qs, urlparse

            qs = parse_qs(urlparse(href).query)
            if "uddg" in qs:
                href = qs["uddg"][0]
        n = normalize_url(href)
        if n and "duckduckgo.com" not in n:
            urls.add(n)
        if len(urls) >= max_results:
            break

    # Also parse plain links in page
    for a in soup.find_all("a", href=True):
        n = normalize_url(a["href"])
        if n and "duckduckgo.com" not in n and "duck.com" not in n:
            urls.add(n)
        if len(urls) >= max_results * 2:
            break

    logger.info("Search %r → %s URLs", query[:80], len(urls))
    return urls


def stackexchange_tag_pages(tag: str = "traefik", pages: int = 25) -> list[str]:
    """Generate Stack Overflow / Server Fault / Super User tag pagination URLs."""
    bases = [
        f"https://stackoverflow.com/questions/tagged/{tag}",
        f"https://serverfault.com/questions/tagged/{tag}",
        f"https://superuser.com/questions/tagged/{tag}",
    ]
    urls: list[str] = []
    for base in bases:
        urls.append(base)
        for page in range(2, pages + 1):
            urls.append(f"{base}?tab=newest&page={page}")
            urls.append(f"{base}?tab=votes&page={page}")
    return urls


def github_discovery_urls() -> list[str]:
    """Known Traefik GitHub org / repo discovery endpoints."""
    org = "https://github.com/traefik"
    repo = f"{org}/traefik"
    urls = [
        org,
        f"{org}?tab=repositories",
        repo,
        f"{repo}/issues",
        f"{repo}/discussions",
        f"{repo}/wiki",
        f"{repo}/releases",
        f"{repo}/pulls",
        f"{repo}/tree/master/docs",
        f"{repo}/tree/master/examples",
        f"{repo}/tree/master/pkg",
        f"{repo}/blob/master/README.md",
        f"{repo}/security/advisories",
        "https://raw.githubusercontent.com/traefik/traefik/master/README.md",
        "https://api.github.com/orgs/traefik/repos?per_page=100",
        "https://api.github.com/repos/traefik/traefik/contents/docs",
    ]
    # Issue / discussion pagination
    for page in range(1, 31):
        urls.append(f"{repo}/issues?page={page}&q=is%3Aissue")
        urls.append(f"{repo}/issues?page={page}&q=is%3Apr")
        urls.append(f"{repo}/discussions?page={page}")
    return urls


def discourse_discovery_urls() -> list[str]:
    """Traefik community Discourse indexes."""
    base = "https://community.traefik.io"
    urls = [
        base,
        f"{base}/latest",
        f"{base}/top",
        f"{base}/categories",
        f"{base}/sitemap.xml",
        f"{base}/robots.txt",
        f"{base}/search?q=traefik",
    ]
    for page in range(0, 50):
        urls.append(f"{base}/latest.json?page={page}")
        urls.append(f"{base}/top.json?page={page}")
    return urls


def doc_traefik_discovery() -> list[str]:
    """Official docs version roots commonly used by Traefik."""
    base = "https://doc.traefik.io"
    versions = [
        "traefik",
        "traefik/v3.0",
        "traefik/v3.1",
        "traefik/v3.2",
        "traefik/v3.3",
        "traefik/v2.11",
        "traefik/v2.10",
        "traefik/master",
        "traefik-enterprise",
        "traefik-hub",
        "traefik-mesh",
    ]
    urls = [f"{base}/", f"{base}/robots.txt", f"{base}/sitemap.xml"]
    for v in versions:
        urls.append(f"{base}/{v}/")
        urls.append(f"{base}/{v}/sitemap.xml")
    return urls


def curated_extra_seeds() -> list[str]:
    """High-signal pages that expand the crawl frontier quickly."""
    return [
        "https://doc.traefik.io/traefik/",
        "https://doc.traefik.io/traefik/getting-started/configuration-overview/",
        "https://doc.traefik.io/traefik/routing/overview/",
        "https://doc.traefik.io/traefik/middlewares/overview/",
        "https://doc.traefik.io/traefik/https/acme/",
        "https://doc.traefik.io/traefik/providers/overview/",
        "https://doc.traefik.io/traefik/observability/metrics/overview/",
        "https://plugins.traefik.io/plugins",
        "https://blog.traefik.io/",
        "https://traefik.io/blog/",
        "https://artifacthub.io/packages/search?ts_query_web=traefik",
        "https://hub.docker.com/r/traefik/traefik",
        "https://hub.docker.com/_/traefik",
        "https://medium.com/tag/traefik",
        "https://dev.to/t/traefik",
        "https://www.reddit.com/r/Traefik/",
        "https://www.reddit.com/r/Traefik/new/",
        "https://www.reddit.com/r/selfhosted/search/?q=traefik&restrict_sr=1",
        "https://grafana.com/docs/grafana/latest/datasources/",
        "https://prometheus.io/docs/guides/",
        "https://developers.cloudflare.com/cloudflare-one/",
        "https://www.authelia.com/integration/proxies/traefik/",
        "https://docs.goauthentik.io/docs/providers/proxy/",
        "https://docs.crowdsec.net/docs/bouncers/traefik/",
        "https://developer.hashicorp.com/nomad/docs",
        "https://developer.hashicorp.com/consul/docs",
        "https://kubernetes.io/docs/concepts/services-networking/gateway/",
        "https://helm.sh/docs/",
        "https://docs.docker.com/engine/swarm/",
        "https://docs.docker.com/compose/",
        "https://letsencrypt.org/docs/",
        "https://www.digitalocean.com/community/tutorial_series",
        "https://www.digitalocean.com/community/tags/traefik",
        "https://www.linode.com/docs/",
        "https://www.baeldung.com/ops/",
        "https://linuxhandbook.com/",
        "https://computingforgeeks.com/?s=traefik",
        "https://www.phoenixnap.com/kb/",
        "https://www.vultr.com/docs/",
        # GitHub code search landing (HTML)
        "https://github.com/search?q=traefik&type=repositories",
        "https://github.com/search?q=traefik+middleware&type=code",
        "https://github.com/topics/traefik",
    ]


def quote(s: str) -> str:
    return quote_plus(s)
