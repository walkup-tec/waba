# LOG — Traefik Easypanel down (443 / WABA)

**Data:** 2026-06-20  
**VPS:** srv1261237 (72.60.51.127)

## Sintoma

```text
curl https://waba.draxsistemas.com.br/health
curl: (7) Failed to connect ... port 443
```

## Diagnóstico (root@srv1261237)

| Check | Resultado |
|-------|-----------|
| DNS waba → IP VPS | OK (72.60.51.127) |
| `:443` listening | **NADA** |
| `docker ps \| grep traefik` | **Traefik NÃO running** |
| `waba_waba_disparador` | **1/1 Running** |
| `http://127.0.0.1:30180/health` | **Falha** (porta não publicada) |

## Causa

1. **Proxy Easypanel (Traefik) parado** — todo HTTPS do VPS cai (não só WABA).
2. **Porta host 30180** ausente no serviço Swarm — script Traefik WABA usa `172.17.0.1:30180`.

## Recuperação (ordem)

1. Subir/restart `easypanel-traefik` (Swarm ou painel Easypanel).
2. Confirmar `ss -tlnp | grep ':443'`.
3. `docker service update --publish-add published=30180,target=80,protocol=tcp waba_waba_disparador`
4. `/root/traefik-permanent-waba-vps.sh run` (ou `traefik-permanent-all-vps.sh install`).
5. `curl https://waba.draxsistemas.com.br/health` → 200 + deployMarker.

## Palavras-chave

`traefik-down`, `curl-7`, `443`, `easypanel-traefik`, `30180`
