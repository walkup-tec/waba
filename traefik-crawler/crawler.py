"""Core async Traefik knowledge crawler."""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Deque
from urllib.parse import urlparse

from tqdm import tqdm

from config import (
    CHECKPOINT_EVERY,
    CHECKPOINT_FILE,
    LOG_FILE,
    MAX_CONCURRENCY,
    MAX_DEPTH,
    MAX_PAGES_PER_DOMAIN,
    MAX_URLS,
    PRIORITY_DOMAINS,
    QUEUE_FILE,
    SEED_URLS,
    SEEN_FILE,
    STATS_FILE,
    URLS_FILE,
)
from extractors.links import extract_all, guess_robots_and_sitemap
from http_client import HttpClient
from search.discovery import (
    build_search_queries,
    curated_extra_seeds,
    discourse_discovery_urls,
    doc_traefik_discovery,
    github_discovery_urls,
    search_duckduckgo,
    stackexchange_tag_pages,
)
from utils.checkpoint import CheckpointStore, CrawlStats
from utils.logging_setup import setup_logging
from utils.url_utils import (
    domain_of,
    is_always_relevant,
    is_relevant_url,
    is_valid_url,
    normalize_url,
    text_mentions_traefik,
)

logger = setup_logging(LOG_FILE)


class TraefikCrawler:
    def __init__(self, max_urls: int = MAX_URLS, concurrency: int = MAX_CONCURRENCY) -> None:
        self.max_urls = max_urls
        self.concurrency = concurrency
        self.store = CheckpointStore(
            checkpoint_file=CHECKPOINT_FILE,
            seen_file=SEEN_FILE,
            queue_file=QUEUE_FILE,
            urls_file=URLS_FILE,
            stats_file=STATS_FILE,
        )
        self.collected: set[str] = set()
        self.seen: set[str] = set()  # URLs already fetched or queued for fetch
        self.queue: Deque[tuple[str, int]] = deque()
        self.domain_fetch_count: dict[str, int] = defaultdict(int)
        self.stats = CrawlStats()
        self.duplicates_removed = 0
        self.searched_queries: list[str] = []
        self._since_checkpoint = 0
        self._lock = asyncio.Lock()

    def bootstrap(self) -> None:
        """Load checkpoint or seed the frontier."""
        self.collected = self.store.load_collected()
        self.seen = self.store.load_seen()
        meta = self.store.load_meta()
        self.searched_queries = list(meta.get("searched_queries") or [])
        if meta.get("stats"):
            s = meta["stats"]
            self.stats.duplicates_removed = int(s.get("duplicates_removed") or 0)
            self.stats.pages_fetched = int(s.get("pages_fetched") or 0)
            self.stats.pages_failed = int(s.get("pages_failed") or 0)
            self.stats.search_queries_done = int(s.get("search_queries_done") or 0)

        queued = self.store.load_queue()
        if self.collected or queued:
            logger.info(
                "Resuming: collected=%s seen=%s queue=%s",
                len(self.collected),
                len(self.seen),
                len(queued),
            )
            for url, depth in queued:
                self.queue.append((url, depth))
        else:
            logger.info("Fresh start — seeding frontier")

        # Always (re)inject seeds & discovery URLs (deduped via enqueue)
        seeds: list[str] = []
        seeds.extend(SEED_URLS)
        seeds.extend(curated_extra_seeds())
        seeds.extend(doc_traefik_discovery())
        seeds.extend(github_discovery_urls())
        seeds.extend(discourse_discovery_urls())
        seeds.extend(stackexchange_tag_pages("traefik", pages=30))

        for u in seeds:
            self._enqueue(u, depth=0, force_collect=True)

        # Ensure robots/sitemap for every seed host
        hosts: set[str] = set()
        for u in list(seeds):
            p = urlparse(u)
            if p.scheme and p.netloc:
                hosts.add(f"{p.scheme}://{p.netloc}")
        for origin in hosts:
            for disc in guess_robots_and_sitemap(origin + "/"):
                self._enqueue(disc, depth=0, force_collect=True)

        self.duplicates_removed = self.stats.duplicates_removed
        logger.info(
            "Frontier ready: collected=%s queue=%s",
            len(self.collected),
            len(self.queue),
        )

    def _enqueue(self, url: str, depth: int, force_collect: bool = False) -> bool:
        norm = normalize_url(url)
        if not norm or not is_valid_url(norm):
            return False

        # Collect relevant URLs immediately
        relevant = force_collect or is_relevant_url(norm)
        if relevant:
            if norm in self.collected:
                self.duplicates_removed += 1
                self.stats.duplicates_removed = self.duplicates_removed
            else:
                if len(self.collected) >= self.max_urls:
                    return False
                self.collected.add(norm)
                self._since_checkpoint += 1

        # Decide whether to crawl further
        if depth > MAX_DEPTH:
            return relevant

        host = domain_of(norm)
        if self.domain_fetch_count[host] >= MAX_PAGES_PER_DOMAIN:
            return relevant

        # Only crawl priority / always-relevant hosts deeply; others only if URL itself is relevant
        if host not in PRIORITY_DOMAINS and not is_always_relevant(norm) and not is_relevant_url(norm):
            return relevant

        if norm in self.seen:
            return relevant

        self.seen.add(norm)
        self.queue.append((norm, depth))
        return True

    async def _maybe_checkpoint(self, force: bool = False) -> None:
        if force or self._since_checkpoint >= CHECKPOINT_EVERY:
            async with self._lock:
                if force or self._since_checkpoint >= CHECKPOINT_EVERY:
                    self.store.save_progress(
                        collected=self.collected,
                        seen=self.seen,
                        queue=list(self.queue),
                        stats=self.stats,
                        searched_queries=self.searched_queries,
                    )
                    self._since_checkpoint = 0

    async def run_search_phase(self, client: HttpClient, max_queries: int = 80) -> None:
        """Light search after crawl — capped to avoid DDG rate-limit stalls."""
        queries = build_search_queries()[:max_queries]
        remaining = [q for q in queries if q not in self.searched_queries]
        logger.info("Search phase: %s queries remaining (cap=%s)", len(remaining), max_queries)

        for i, q in enumerate(tqdm(remaining, desc="Search queries", unit="q"), start=1):
            if len(self.collected) >= self.max_urls:
                break
            found = await search_duckduckgo(client, q)
            for u in found:
                self._enqueue(u, depth=0)
            self.searched_queries.append(q)
            self.stats.search_queries_done = len(self.searched_queries)
            if i % 5 == 0 or self._since_checkpoint >= 50:
                await self._maybe_checkpoint(force=True)
            await asyncio.sleep(0.4)

    async def _process_one(self, client: HttpClient, url: str, depth: int) -> None:
        if len(self.collected) >= self.max_urls:
            return

        host = domain_of(url)
        if self.domain_fetch_count[host] >= MAX_PAGES_PER_DOMAIN:
            return
        self.domain_fetch_count[host] += 1

        result = await client.fetch(url)
        if not result.ok:
            self.stats.pages_failed += 1
            # Still keep the URL if it looked relevant and was already collected
            return

        self.stats.pages_fetched += 1
        final = normalize_url(result.final_url) or url
        if final != url:
            self._enqueue(final, depth=depth, force_collect=is_relevant_url(final))

        content = result.content
        # Relevance gate for non-core domains: only expand if page mentions Traefik
        host_ok = is_always_relevant(url) or domain_of(url) in PRIORITY_DOMAINS
        page_relevant = host_ok or text_mentions_traefik(content) or is_relevant_url(url, content)

        if page_relevant:
            self._enqueue(final, depth=depth, force_collect=True)

        if not page_relevant and not host_ok:
            return

        links = extract_all(content, result.content_type, final)
        for link in links:
            # Prefer collecting Traefik-relevant links; still follow internal links on priority hosts
            link_host = domain_of(link)
            force = is_always_relevant(link) or is_relevant_url(link)
            if force or link_host == host or link_host in PRIORITY_DOMAINS:
                self._enqueue(link, depth=depth + 1, force_collect=force)

    async def run_crawl_phase(self, client: HttpClient) -> None:
        logger.info("Crawl phase starting — queue=%s collected=%s", len(self.queue), len(self.collected))
        workers = min(self.concurrency, 32)
        pbar = tqdm(total=self.max_urls, initial=len(self.collected), desc="URLs collected", unit="url")

        async def worker() -> None:
            while len(self.collected) < self.max_urls:
                try:
                    url, depth = self.queue.popleft()
                except IndexError:
                    await asyncio.sleep(0.2)
                    if not self.queue:
                        return
                    continue

                before = len(self.collected)
                try:
                    await self._process_one(client, url, depth)
                except Exception as exc:
                    logger.debug("Worker error on %s: %s", url, exc)
                    self.stats.pages_failed += 1

                after = len(self.collected)
                if after > before:
                    pbar.update(after - before)
                await self._maybe_checkpoint()

        tasks = [asyncio.create_task(worker()) for _ in range(workers)]

        # Watchdog: exit when queue drains and workers idle
        while any(not t.done() for t in tasks):
            if len(self.collected) >= self.max_urls:
                break
            if not self.queue and all(not t.done() for t in tasks):
                # give workers a moment to pick up
                await asyncio.sleep(1.0)
                if not self.queue:
                    break
            await asyncio.sleep(0.5)

        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        pbar.n = len(self.collected)
        pbar.refresh()
        pbar.close()

    async def run(self) -> CrawlStats:
        started = time.perf_counter()
        self.stats.started_at = datetime.now(timezone.utc).isoformat()
        self.bootstrap()

        async with HttpClient(concurrency=self.concurrency) as client:
            # Phase 1: BFS + sitemaps first (fast volume)
            try:
                await self.run_crawl_phase(client)
            except Exception as exc:
                logger.warning("Crawl phase interrupted: %s", exc)

            await self._maybe_checkpoint(force=True)

            # Phase 2: light search to expand frontier, then crawl again
            try:
                await self.run_search_phase(client)
            except Exception as exc:
                logger.warning("Search phase interrupted: %s", exc)

            await self._maybe_checkpoint(force=True)

            if self.queue and len(self.collected) < self.max_urls:
                try:
                    await self.run_crawl_phase(client)
                except Exception as exc:
                    logger.warning("Second crawl interrupted: %s", exc)

        elapsed = time.perf_counter() - started
        self.stats.elapsed_seconds = round(elapsed, 2)
        self.stats.finished_at = datetime.now(timezone.utc).isoformat()
        self.stats.total_urls = len(self.collected)
        self.stats.duplicates_removed = self.duplicates_removed
        self.stats.by_domain = {}
        # Final save (sorted)
        self.store.save_progress(
            collected=self.collected,
            seen=self.seen,
            queue=list(self.queue),
            stats=self.stats,
            searched_queries=self.searched_queries,
            force_full_rewrite=True,
        )
        # Reload domain stats from store
        from utils.checkpoint import _count_by_domain

        self.stats.by_domain = _count_by_domain(self.collected)
        self.store.stats_file.write_text(
            __import__("json").dumps(self.stats.to_dict(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return self.stats


def print_stats(stats: CrawlStats) -> None:
    print("\n" + "=" * 60)
    print("TRAEFIK CRAWLER — STATISTICS")
    print("=" * 60)
    print(f"Total URLs collected : {stats.total_urls}")
    print(f"Duplicates removed   : {stats.duplicates_removed}")
    print(f"Pages fetched        : {stats.pages_fetched}")
    print(f"Pages failed         : {stats.pages_failed}")
    print(f"Search queries done  : {stats.search_queries_done}")
    print(f"Elapsed seconds      : {stats.elapsed_seconds}")
    print(f"Started at (UTC)     : {stats.started_at}")
    print(f"Finished at (UTC)    : {stats.finished_at}")
    print("-" * 60)
    print("URLs by domain (top 40):")
    items = list(stats.by_domain.items())[:40]
    for domain, count in items:
        print(f"  {count:6d}  {domain}")
    if len(stats.by_domain) > 40:
        print(f"  ... +{len(stats.by_domain) - 40} more domains")
    print("=" * 60)
    print(f"Output file: {URLS_FILE}")
