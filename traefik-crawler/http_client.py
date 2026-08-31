"""Async HTTP client with retries and rotating user-agents."""

from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import dataclass
from typing import Optional

import aiohttp
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config import (
    CONNECT_TIMEOUT,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_WAIT_MAX,
    RETRY_WAIT_MIN,
    USER_AGENT_FALLBACK,
)

logger = logging.getLogger("traefik_crawler")

# Static pool — avoids fake-useragent online lookup failures / spam
_UA_POOL = [
    USER_AGENT_FALLBACK,
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (compatible; TraefikKnowledgeCrawler/1.1; +https://doc.traefik.io/)",
]


@dataclass
class FetchResult:
    url: str
    status: int
    content: str
    content_type: str
    final_url: str
    ok: bool
    error: str = ""


class HttpClient:
    def __init__(self, concurrency: int = 24) -> None:
        self.semaphore = asyncio.Semaphore(concurrency)
        self._session: Optional[aiohttp.ClientSession] = None

    def _headers(self) -> dict[str, str]:
        return {
            "User-Agent": random.choice(_UA_POOL),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
            "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
            "Cache-Control": "no-cache",
        }

    async def __aenter__(self) -> "HttpClient":
        timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT, connect=CONNECT_TIMEOUT)
        connector = aiohttp.TCPConnector(limit=self.semaphore._value, ssl=False, ttl_dns_cache=300)
        self._session = aiohttp.ClientSession(
            timeout=timeout,
            connector=connector,
            headers=self._headers(),
            raise_for_status=False,
        )
        return self

    async def __aexit__(self, *exc: object) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    async def fetch(self, url: str, method: str = "GET", data: dict | None = None) -> FetchResult:
        assert self._session is not None
        async with self.semaphore:
            try:
                async for attempt in AsyncRetrying(
                    stop=stop_after_attempt(MAX_RETRIES),
                    wait=wait_exponential(multiplier=1, min=RETRY_WAIT_MIN, max=RETRY_WAIT_MAX),
                    retry=retry_if_exception_type((aiohttp.ClientError, asyncio.TimeoutError)),
                    reraise=True,
                ):
                    with attempt:
                        return await self._once(url, method=method, data=data)
            except Exception as exc:
                logger.debug("Fetch failed %s: %s", url, exc)
                return FetchResult(
                    url=url,
                    status=0,
                    content="",
                    content_type="",
                    final_url=url,
                    ok=False,
                    error=str(exc),
                )
        return FetchResult(url=url, status=0, content="", content_type="", final_url=url, ok=False, error="unknown")

    async def _once(self, url: str, method: str = "GET", data: dict | None = None) -> FetchResult:
        assert self._session is not None
        headers = self._headers()
        if method.upper() == "POST":
            async with self._session.post(url, data=data, headers=headers, allow_redirects=True) as resp:
                return await self._read(url, resp)
        async with self._session.get(url, headers=headers, allow_redirects=True) as resp:
            return await self._read(url, resp)

    async def _read(self, url: str, resp: aiohttp.ClientResponse) -> FetchResult:
        ctype = resp.headers.get("Content-Type", "")
        clen = resp.headers.get("Content-Length")
        if clen and clen.isdigit() and int(clen) > 8_000_000:
            return FetchResult(
                url=url,
                status=resp.status,
                content="",
                content_type=ctype,
                final_url=str(resp.url),
                ok=False,
                error="too_large",
            )

        try:
            raw = await resp.read()
        except Exception as exc:
            raise aiohttp.ClientError(str(exc)) from exc

        if len(raw) > 8_000_000:
            return FetchResult(
                url=url,
                status=resp.status,
                content="",
                content_type=ctype,
                final_url=str(resp.url),
                ok=False,
                error="too_large",
            )

        try:
            text = raw.decode(resp.charset or "utf-8", errors="replace")
        except Exception:
            text = raw.decode("utf-8", errors="replace")

        ok = 200 <= resp.status < 400
        return FetchResult(
            url=url,
            status=resp.status,
            content=text if ok else "",
            content_type=ctype,
            final_url=str(resp.url),
            ok=ok,
            error="" if ok else f"http_{resp.status}",
        )
