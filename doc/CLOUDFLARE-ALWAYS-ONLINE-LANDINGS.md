# Cloudflare — Always Online + cache (mitigação quando Traefik/VPS cai)

Quando o Traefik no VPS está `0/1` ou `:443` morto, o browser **não** recebe resposta.
`Cache-Control` no origin **não** cobre isso. A mitigação útil para visitantes é a **edge Cloudflare**.

Doc oficial: https://developers.cloudflare.com/cache/how-to/always-online/

## Pré-requisito

DNS dos domínios com **proxy laranja** (proxied):

- `bet.waba.info`
- `wabadisparos.com.br`
- (opcional) `waba.draxsistemas.com.br` — cuidado: app dinâmico; Always Online só ajuda HTML estático

Se o DNS aponta **direto** ao IP do VPS (cinza), Cloudflare não está no meio → Always Online não age.

## Checklist (dashboard Cloudflare)

Para **cada** zona (bet / disparos):

1. **DNS** → registros A/AAAA/CNAME com nuvem **laranja**.
2. **Caching → Configuration → Always Online** → **On**  
   (ativa também integração Internet Archive).
3. **Caching → Cache Rules** (recomendado):
   - HTML (`/`, `*.html`): Edge TTL curto (ex. 2–5 min) ou “Respect origin”
   - Assets estáticos (`/assets/*`, `*.js`, `*.css`, imagens): Edge TTL longo (1 dia+)
4. **SSL/TLS** → Full (strict) se o origin tem cert Let’s Encrypt válido (já temos ACME no Traefik).
5. Opcional: **Speed → Optimization** (sem quebrar SPA).

## O que Always Online faz / não faz

| Situação | Always Online |
|----------|----------------|
| Origin inalcançável (Traefik down, VPS off) → CF 52x | Pode servir cache stale / Archive |
| Origin responde 502/404 | **Não** intervém (origin “vivo”) |
| Login / API / formulário | Não substitui backend |

## Validar

1. Com site no ar, visite a home uma vez (popular cache).
2. No VPS: `docker service scale easypanel-traefik=0` **só em janela de teste** (ou pare Traefik).
3. Do celular/outra rede: abrir `https://bet.waba.info/` — deve ver cópia em cache ou banner Always Online.
4. Subir Traefik de novo: `bash /root/traefik-easypanel-bootstrap-vps.sh run`

## Complemento no VPS (já no repo)

- `traefik-443-watchdog` a cada **45s** → bootstrap automático
- Uptime monitor WABA (WhatsApp) a cada **5 min** (default atualizado)
- Guard entryPoints + URL `:30211`

## Webhook opcional no watchdog

```bash
# Ex.: Slack/Discord/n8n
export WABA_TRAEFIK_ALERT_WEBHOOK='https://...'
# reinstalar watchdog para pegar o env no unit, ou editar o service:
systemctl edit waba-traefik-443-watchdog.service
# [Service]
# Environment=WABA_TRAEFIK_ALERT_WEBHOOK=https://...
```
