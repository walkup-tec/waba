#!/usr/bin/env python3
"""Search the Traefik URL corpus by keywords (RAG helper for the Cursor agent).

Usage:
  py -3 scripts/traefik-kb-search.py "entryPoints websecure" --limit 20
  py -3 scripts/traefik-kb-search.py acme certificate --prefer doc.traefik.io
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

DEFAULT_CORPORA = [
    Path(r"E:\Waba\traefik-crawler\urls.txt"),
    Path(__file__).resolve().parents[1] / "traefik-crawler" / "urls.txt",
]

TRUST_BONUS = {
    "doc.traefik.io": 50,
    "community.traefik.io": 40,
    "blog.traefik.io": 30,
    "plugins.traefik.io": 30,
    "github.com/traefik": 35,
    "traefik.io": 25,
    "docs.crowdsec.net": 10,
    "docs.goauthentik.io": 10,
    "www.authelia.com": 10,
    "docs.docker.com": 8,
    "kubernetes.io": 8,
}


def find_corpus() -> Path:
    for p in DEFAULT_CORPORA:
        if p.is_file():
            return p
    raise SystemExit(
        "urls.txt not found. Expected E:\\Waba\\traefik-crawler\\urls.txt "
        "or ./traefik-crawler/urls.txt"
    )


def score_url(url: str, terms: list[str], prefer: str | None) -> int:
    lower = url.lower()
    score = 0
    for t in terms:
        if t in lower:
            score += 10 + lower.count(t)
    for needle, bonus in TRUST_BONUS.items():
        if needle in lower:
            score += bonus
    if prefer and prefer.lower() in lower:
        score += 40
    # Prefer https docs paths
    if "/docs" in lower or "doc.traefik" in lower:
        score += 5
    return score


def main() -> int:
    parser = argparse.ArgumentParser(description="Search Traefik URL knowledge base")
    parser.add_argument("terms", nargs="+", help="Keywords (AND boost; OR match)")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--prefer", type=str, default="", help="Domain/substring boost")
    parser.add_argument("--corpus", type=Path, default=None)
    args = parser.parse_args()

    corpus = args.corpus or find_corpus()
    terms = [t.lower() for t in args.terms]
    prefer = args.prefer.strip() or None

    hits: list[tuple[int, str]] = []
    with corpus.open("r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            url = line.strip()
            if not url:
                continue
            lower = url.lower()
            if not any(t in lower for t in terms):
                continue
            hits.append((score_url(url, terms, prefer), url))

    hits.sort(key=lambda x: (-x[0], x[1]))
    top = hits[: args.limit]

    print(f"# corpus={corpus}")
    print(f"# terms={terms} matches={len(hits)} showing={len(top)}")
    for score, url in top:
        print(f"{score:4d}  {url}")
    return 0 if top else 1


if __name__ == "__main__":
    sys.exit(main())
