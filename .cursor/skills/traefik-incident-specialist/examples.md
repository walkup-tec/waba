# Exemplos — Agente Traefik Incidentes

## Invocação no Cursor

```
@traefik-incident-specialist bet.waba.info voltou a dar 404
```

```
@traefik-incident-specialist HTTPS 000 / Traefik parece down — encontre causa definitiva
```

```
Queda no login waba após redeploy — foi Traefik? Corrija e registre a causa.
```

## Exemplo: 404 por entryPoints

**Entrada:** `bet.waba.info` 404; `wabadisparos.com.br` 200; `:30211` local 200.

**Ações do agente:**
1. Ler `doc/traefik-causes/REGISTRY.md` → causa `EP-WEBSECURE`
2. `kb_search.py "entryPoints https websecure"`
3. Confirmar doc: https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/
4. Rodar / orientar `traefik-entrypoint-guard-vps.sh run`
5. Validar HTTPS 200; marcar reincidência no REGISTRY se já existia

## Exemplo: 502 pós-redeploy (login)

**Entrada:** Login «Não foi possível entrar»; `/health` HTTPS 502.

**Ações:**
1. `curl http://127.0.0.1:30180/health` — se 200, é Traefik/publish
2. REGISTRY `LOGIN-30180-PUBLISH`
3. `heal-waba-login-vps.sh run` (+ garantir timer instalado)
4. LOG + memoria

## Exemplo: consulta RAG

```powershell
cd E:\Waba
py -3 scripts\traefik-kb-search.py "file provider hot reload" --limit 15 --prefer doc.traefik.io
```

Saída esperada: lista de URLs ranqueadas → agente faz WebFetch nas top 3.
