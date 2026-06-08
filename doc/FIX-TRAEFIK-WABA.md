# Fix Traefik — WABA (502 Bad Gateway)

## Escopo

Script **exclusivo deste repositório** (`walkup-tec/waba`).  
**Não** usar `traefik-permanent-vps.sh` do projeto Typebot — cada SaaS tem o seu.

| Projeto | Easypanel | Script VPS |
|---------|-----------|------------|
| **WABA** | `waba` / `waba_disparador` | `/root/traefik-permanent-waba-vps.sh` |
| Typebot | `typebot` / … | `/root/traefik-permanent-vps.sh` (repo typeBot) |

## Sintoma

- `https://waba.draxsistemas.com.br/` → **502 Bad Gateway**
- `https://waba.draxsistemas.com.br/health` → **502** (corpo vazio)

Isso é **proxy sem upstream**, não bug do Express.

## Causa raiz (mesma classe do Typebot)

1. Redeploy Swarm troca o IP do container `waba_waba_disparador`.
2. `main.yaml` do Traefik fica com IP/hostname morto.
3. Traefik pode estar fora da rede overlay `easypanel-waba`.
4. Serviço parado, Pending ou domínio apontando para deploy estático (FTP) sem Node.
5. **Porta errada no Traefik:** no Easypanel o `PORT` do serviço pode ser **80** (log: `servidor rodando em http://localhost:80`), enquanto o script assumia **3000** → HTTPS 404. O script atual detecta `PORT` do container ou testa 80/3000.

## Instalação permanente (VPS — uma vez)

```bash
# Do repo WABA no servidor (ou curl do GitHub após push)
cp /caminho/waba/scripts/traefik-permanent-waba-vps.sh /root/
chmod +x /root/traefik-permanent-waba-vps.sh
/root/traefik-permanent-waba-vps.sh install
```

Se erro `cannot execute: required file not found` (CRLF Windows):

```bash
sed -i 's/\r$//' /root/traefik-permanent-waba-vps.sh
chmod +x /root/traefik-permanent-waba-vps.sh
/root/traefik-permanent-waba-vps.sh install
```

### O que o `install` faz

| Ação | Efeito |
|------|--------|
| Conecta Traefik às redes `easypanel*` / `waba` | Proxy alcança o container |
| Patch `main.yaml` só para **waba_disparador** | IP atual na porta **3000** |
| Watcher + timer 20s + cron 1 min | Corrige após redeploy sem SSH manual |
| Log | `/var/log/traefik-permanent-waba-fix.log` |

## Verificação

```bash
/root/traefik-permanent-waba-vps.sh run
# Esperado: RESULTADO waba:200 health:200

/root/traefik-permanent-waba-vps.sh status
tail -30 /var/log/traefik-permanent-waba-fix.log
```

Diagnóstico pontual:

```bash
bash /caminho/waba/scripts/diagnose-waba-502-vps.sh
```

## Variáveis opcionais

```bash
export WABA_PUBLIC_HOST=waba.draxsistemas.com.br
export WABA_SWARM_SERVICE=waba_waba_disparador
export WABA_CONTAINER_FILTER=waba_disparador
export WABA_NET=easypanel-waba
# Se usar também o host *.easypanel.host:
export WABA_EASYPANEL_HOST=waba-waba-disparador.achpyp.easypanel.host
/root/traefik-permanent-waba-vps.sh run
```

## Easypanel — checklist

1. Projeto **waba**, serviço **waba_disparador** em **Running**.
2. Build Docker (`node dist/index.js`), não só FTP estático no mesmo domínio.
3. Domínio `waba.draxsistemas.com.br` no serviço que executa a API.
4. Volume **`/app/data`** montado (estado de campanhas).
5. Evitar porta publicada no host em conflito (Swarm Pending) — mesmo padrão do painel Typebot: `scale 0` → `scale 1`.

## Após redeploy no Easypanel

Com `install` feito: correção automática em até ~20s. Opcional:

```bash
/root/traefik-permanent-waba-vps.sh run
```

## Correções já no código (não resolvem 502 na raiz)

- Rotas extras Embedded Signup (proxy strip `/api`)
- Status **424** em vez de **502** na troca de code Meta (evita HTML do EasyPanel em erros de API)

Ver `doc/LOG-2026-04-07__112500__fix-meta-exchange-avoid-502-html-middleware.md`.

## Scripts neste repo

| Arquivo | Uso |
|---------|-----|
| `scripts/traefik-permanent-waba-vps.sh` | Fix permanente WABA |
| `scripts/diagnose-waba-502-vps.sh` | Diagnóstico pontual |
