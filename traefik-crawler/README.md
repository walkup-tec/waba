# Traefik Knowledge Crawler

Professional async crawler that finds the largest possible set of Traefik-related
URLs for AI / RAG corpora (Cursor, embeddings, etc.).

**Output:** `urls.txt` (one URL per line, sorted, unique).

## Features

- Async parallel crawling (`aiohttp` + semaphore)
- Automatic retries with exponential backoff (`tenacity`)
- Rotating User-Agent (`fake-useragent`)
- Seed crawl from official Traefik docs, blog, community, GitHub, Docker Hub, etc.
- DuckDuckGo HTML search for 35+ Traefik query variants + `site:` filters
- Follows `robots.txt`, `sitemap.xml`, HTML links, Markdown, READMEs, JSON APIs, Discourse indexes
- Pagination for Stack Overflow / GitHub issues / Discourse
- Relevance filter (Traefik keywords + always-on official domains)
- Deduplication, fragment / `mailto` / `javascript` stripping
- Checkpoint every 500 URLs — safe to interrupt and resume
- Hard cap: 50,000 unique URLs

## Requirements

- Python 3.12+
- Network access

## Install

```bash
cd traefik-crawler
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
```

## Run

Full crawl (search + BFS, up to 50k URLs):

```bash
python main.py
```

Custom limits:

```bash
python main.py --max-urls 10000 --concurrency 16
```

Resume after interrupt (default — uses `data/`):

```bash
python main.py
```

Start fresh:

```bash
python main.py --reset
```

Skip DuckDuckGo search (seeds + sitemaps only):

```bash
python main.py --skip-search
```

## Output

| File | Description |
|------|-------------|
| `urls.txt` | Canonical list (sorted, one URL per line) |
| `output/stats.json` | Totals, per-domain counts, timings |
| `output/crawler.log` | Detailed log |
| `data/checkpoint.json` | Resume metadata |
| `data/seen_urls.txt` | URLs already visited/queued |
| `data/queue.txt` | Pending crawl frontier |

## Statistics

At the end the crawler prints:

- Total unique URLs
- Duplicates removed
- Pages fetched / failed
- Search queries completed
- Elapsed time
- Top domains by URL count

## Project layout

```
traefik-crawler/
├── main.py
├── crawler.py
├── config.py
├── http_client.py
├── requirements.txt
├── README.md
├── urls.txt
├── extractors/
│   └── links.py
├── search/
│   └── discovery.py
├── utils/
│   ├── url_utils.py
│   ├── checkpoint.py
│   └── logging_setup.py
├── data/
└── output/
```

## Notes for RAG

- Prefer `doc.traefik.io`, `community.traefik.io`, and `github.com/traefik/*` as high-trust sources.
- Re-run periodically; checkpointing makes incremental updates cheap.
- Respect site ToS / robots when using the corpus commercially.

## License

Internal / project use (WABA knowledge base).
