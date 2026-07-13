# Traefik Knowledge Crawler
#
# Professional async crawler that discovers Traefik-related URLs for RAG / Cursor.
#
# Structure:
#   main.py           CLI entrypoint
#   crawler.py        Orchestrator (search + BFS crawl + checkpoint)
#   config.py         Seeds, queries, limits
#   http_client.py    aiohttp + tenacity retries + fake-useragent
#   extractors/       HTML / XML / Markdown / JSON / robots parsers
#   search/           DuckDuckGo + curated discovery URLs
#   utils/            URL normalize, logging, checkpoint
#   data/             Resume state (seen, queue, checkpoint.json)
#   output/           urls.txt, crawler.log, stats.json
#   urls.txt          Canonical deliverable (copy of output/urls.txt)
