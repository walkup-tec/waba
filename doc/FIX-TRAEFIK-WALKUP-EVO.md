# Fix Traefik — Evolution API walkup (404/502)

> **Instalação definitiva (recomendado):** use o script mestre que cobre WABA + Evolution + guarda do `main.yaml` → **[FIX-TRAEFIK-DEFINITIVO.md](FIX-TRAEFIK-DEFINITIVO.md)**

## Escopo

Script **deste repositório** para o projeto Easypanel **walkup**, serviço **evo-walkup-api**.

| Projeto | Serviço | Script VPS |
|---------|---------|------------|
| **walkup** | `evo-walkup-api` | `/root/traefik-permanent-walkup-evo-vps.sh` |
| **waba** | `waba_disparador` | `/root/traefik-permanent-waba-vps.sh` |
| **typebot** | LP/painel/API | `/root/traefik-permanent-vps.sh` |

Mesmo padrão do Typebot: após redeploy Swarm, `main.yaml` fica com upstream morto → **404** ou **502**.

## Sintoma

- `https://walkup-evo-walkup-api.achpyp.easypanel.host/instance/fetchInstances` → **404** ou **502**
- WABA local: *"Evolution API indisponível (404)"* ao gerar QR

## Causa raiz

1. Easypanel regenera `main.yaml` com `http://walkup_evo-walkup-api:8080/` — Traefik não alcança overlay.
2. Solução neste VPS: publicar porta no host e usar **`http://172.17.0.1:30181/`**.

```bash
docker service update --publish-add published=30181,target=8080,protocol=tcp walkup_evo-walkup-api
```

## Instalação permanente (VPS — uma vez)

```bash
cp /caminho/waba/scripts/traefik-permanent-walkup-evo-vps.sh /root/
chmod +x /root/traefik-permanent-walkup-evo-vps.sh
sed -i 's/\r$//' /root/traefik-permanent-walkup-evo-vps.sh   # se veio do Windows
/root/traefik-permanent-walkup-evo-vps.sh install
```

### O que o `install` faz

| Ação | Efeito |
|------|--------|
| Publica `30181→8080` no Swarm (se faltar) | Host gateway alcança Evolution |
| Patch `main.yaml` para `172.17.0.1:30181` | Traefik roteia corretamente |
| Watcher + timer 20s + cron 1 min | Corrige após cada redeploy |
| Log | `/var/log/traefik-permanent-walkup-evo-fix.log` |

## Verificação

```bash
/root/traefik-permanent-walkup-evo-vps.sh run
# Esperado: RESULTADO evo_fetch:200 ou evo_fetch:401 (não 404/502)

bash /caminho/waba/scripts/diagnose-walkup-evo-502-vps.sh
```

## Variáveis opcionais

```bash
export EVO_PUBLIC_HOST=walkup-evo-walkup-api.achpyp.easypanel.host
export EVO_SWARM_SERVICE=walkup_evo-walkup-api
export EVO_HOST_PUBLISHED_PORT=30181
export EVO_API_KEY=429683C4C977415CAAFCCE10F7D57E11
/root/traefik-permanent-walkup-evo-vps.sh run
```

## Após redeploy no Easypanel

Com `install` feito: correção automática em até ~20s.
