# LOG — wabadisparos 502/404 pós-redeploy paginadevendas

## Sintoma
Usuário: página 404 após Redeploy. Probe externo (2026-07-14 ~09:19 BRT):
- `https://wabadisparos.com.br/` → **502**
- `https://waba-paginadevendas.achpyp.easypanel.host/` → **502**
- WABA + bet.waba.info → **200**

## Interpretação
Não é rota Traefik “sumida” sozinha (host Easypanel também 502). Classico pós-redeploy:
1. Swarm `waba_paginadevendas` **0/1** / crash loop, ou
2. Porta host **30210** não publicada, ou
3. App não escuta na porta esperada (Nitro **3000**)

## Diagnóstico + recover (colar no VPS root)

```bash
docker service ls | grep -E 'paginadevendas|traefik|bets_pv'
docker service ps waba_paginadevendas --no-trunc | head -12
ss -tlnp | grep -E ':30210|:443|:80' || true
curl -sS -o /dev/null -w "local30210:%{http_code}\n" --max-time 5 http://127.0.0.1:30210/ || true
curl -sS -o /dev/null -w "dockerproxy:%{http_code}\n" --max-time 5 http://172.17.0.1:30210/ || true

# logs do crash
CID=$(docker ps -q -f name=waba_paginadevendas | head -1)
[ -n "$CID" ] && docker logs --tail 80 "$CID" || docker service logs waba_paginadevendas --tail 80

# republicar porta se sumiu
docker service update --publish-add mode=host,published=30210,target=3000,protocol=tcp waba_paginadevendas || true
sleep 15
curl -sS -o /dev/null -w "after-publish:%{http_code}\n" --max-time 8 http://127.0.0.1:30210/

# backends Traefik (sem force Traefik)
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/fix-landings-both-vps.sh" -o /tmp/fix-landings-both.sh
sed -i 's/\r$//' /tmp/fix-landings-both.sh
timeout 90 bash /tmp/fix-landings-both.sh || true

curl -sS -o /dev/null -w "pub:%{http_code} health:%{http_code}\n" --max-time 15 \
  https://wabadisparos.com.br/ https://wabadisparos.com.br/api/health
```

## Marker esperado (só quando app up)
`DEPLOY-2026-07-14-paginadevendas-cadastro-form` em `GET /api/health`

## Keywords
paginadevendas 502, redeploy crash, 30210, wabadisparos 404
