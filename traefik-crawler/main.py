"""Traefik Knowledge Crawler — CLI entrypoint."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

# Ensure project root is on sys.path
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import MAX_CONCURRENCY, MAX_URLS, URLS_FILE  # noqa: E402
from crawler import TraefikCrawler, print_stats  # noqa: E402


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Professional Traefik knowledge crawler for RAG / Cursor corpora.",
    )
    p.add_argument(
        "--max-urls",
        type=int,
        default=MAX_URLS,
        help=f"Maximum unique URLs to collect (default: {MAX_URLS})",
    )
    p.add_argument(
        "--concurrency",
        type=int,
        default=MAX_CONCURRENCY,
        help=f"Async concurrency (default: {MAX_CONCURRENCY})",
    )
    p.add_argument(
        "--skip-search",
        action="store_true",
        help="Skip DuckDuckGo search phase (crawl seeds only)",
    )
    p.add_argument(
        "--reset",
        action="store_true",
        help="Ignore checkpoint and start fresh (deletes data/ + output/urls.txt)",
    )
    return p.parse_args()


def reset_state() -> None:
    from config import CHECKPOINT_FILE, QUEUE_FILE, SEEN_FILE, STATS_FILE

    for path in (CHECKPOINT_FILE, QUEUE_FILE, SEEN_FILE, URLS_FILE, STATS_FILE):
        if path.exists():
            path.unlink()
            print(f"Removed {path}")


async def async_main() -> int:
    args = parse_args()
    if args.reset:
        reset_state()

    crawler = TraefikCrawler(max_urls=args.max_urls, concurrency=args.concurrency)
    if args.skip_search:
        # Monkey-patch search phase to no-op
        async def _noop_search(_client: object) -> None:
            return None

        crawler.run_search_phase = _noop_search  # type: ignore[method-assign]

    stats = await crawler.run()
    print_stats(stats)
    print(f"Canonical output: {URLS_FILE}")
    return 0 if stats.total_urls > 0 else 1


def main() -> None:
    try:
        raise SystemExit(asyncio.run(async_main()))
    except KeyboardInterrupt:
        print("\nInterrupted — progress was checkpointed. Re-run to resume.")
        raise SystemExit(130) from None


if __name__ == "__main__":
    main()
