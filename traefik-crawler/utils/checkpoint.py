"""Checkpoint / resume persistence."""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("traefik_crawler")


@dataclass
class CrawlStats:
    started_at: str = ""
    finished_at: str = ""
    total_urls: int = 0
    duplicates_removed: int = 0
    pages_fetched: int = 0
    pages_failed: int = 0
    search_queries_done: int = 0
    elapsed_seconds: float = 0.0
    by_domain: dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


class CheckpointStore:
    """Persist seen URLs, queue and stats for resumable crawls."""

    def __init__(
        self,
        checkpoint_file: Path,
        seen_file: Path,
        queue_file: Path,
        urls_file: Path,
        stats_file: Path,
    ) -> None:
        self.checkpoint_file = checkpoint_file
        self.seen_file = seen_file
        self.queue_file = queue_file
        self.urls_file = urls_file
        self.stats_file = stats_file
        for p in (
            checkpoint_file.parent,
            seen_file.parent,
            queue_file.parent,
            urls_file.parent,
            stats_file.parent,
        ):
            p.mkdir(parents=True, exist_ok=True)

    def load_seen(self) -> set[str]:
        if not self.seen_file.exists():
            return set()
        urls: set[str] = set()
        with self.seen_file.open("r", encoding="utf-8") as fh:
            for line in fh:
                u = line.strip()
                if u:
                    urls.add(u)
        return urls

    def load_collected(self) -> set[str]:
        if not self.urls_file.exists():
            return set()
        urls: set[str] = set()
        with self.urls_file.open("r", encoding="utf-8") as fh:
            for line in fh:
                u = line.strip()
                if u:
                    urls.add(u)
        return urls

    def load_queue(self) -> list[tuple[str, int]]:
        """Return list of (url, depth)."""
        if not self.queue_file.exists():
            return []
        items: list[tuple[str, int]] = []
        with self.queue_file.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                if "\t" in line:
                    url, depth_s = line.split("\t", 1)
                    try:
                        depth = int(depth_s)
                    except ValueError:
                        depth = 0
                else:
                    url, depth = line, 0
                items.append((url, depth))
        return items

    def load_meta(self) -> dict:
        if not self.checkpoint_file.exists():
            return {}
        try:
            return json.loads(self.checkpoint_file.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Failed to read checkpoint meta: %s", exc)
            return {}

    def save_progress(
        self,
        collected: set[str],
        seen: set[str],
        queue: list[tuple[str, int]],
        stats: CrawlStats,
        searched_queries: list[str],
        force_full_rewrite: bool = False,
    ) -> None:
        """Rewrite checkpoint artifacts (atomic-ish via temp files)."""
        # Sorted urls.txt
        sorted_urls = sorted(collected)
        tmp_urls = self.urls_file.with_suffix(".tmp")
        tmp_urls.write_text("\n".join(sorted_urls) + ("\n" if sorted_urls else ""), encoding="utf-8")
        tmp_urls.replace(self.urls_file)

        # Seen
        tmp_seen = self.seen_file.with_suffix(".tmp")
        tmp_seen.write_text("\n".join(sorted(seen)) + ("\n" if seen else ""), encoding="utf-8")
        tmp_seen.replace(self.seen_file)

        # Queue (cap to avoid huge files)
        max_queue_persist = 50_000
        q_slice = queue[:max_queue_persist]
        tmp_q = self.queue_file.with_suffix(".tmp")
        with tmp_q.open("w", encoding="utf-8") as fh:
            for url, depth in q_slice:
                fh.write(f"{url}\t{depth}\n")
        tmp_q.replace(self.queue_file)

        stats.total_urls = len(collected)
        stats.by_domain = _count_by_domain(collected)
        meta = {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "total_urls": len(collected),
            "seen_count": len(seen),
            "queue_count": len(queue),
            "searched_queries": searched_queries,
            "stats": stats.to_dict(),
            "force_full_rewrite": force_full_rewrite,
        }
        tmp_cp = self.checkpoint_file.with_suffix(".tmp")
        tmp_cp.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp_cp.replace(self.checkpoint_file)

        self.stats_file.write_text(
            json.dumps(stats.to_dict(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        logger.info(
            "Checkpoint saved: %s URLs | seen=%s | queue=%s",
            len(collected),
            len(seen),
            len(queue),
        )


def _count_by_domain(urls: set[str]) -> dict[str, int]:
    from utils.url_utils import domain_of

    counts: dict[str, int] = {}
    for u in urls:
        d = domain_of(u) or "unknown"
        counts[d] = counts.get(d, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))
