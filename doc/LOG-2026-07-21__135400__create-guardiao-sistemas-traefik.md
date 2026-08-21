# LOG — Guardião de Sistemas Traefik

## Contexto

Deploy do Sinal Verde voltou a regenerar o `main.yaml` compartilhado do
Easypanel. Rotas isoladas foram duplicadas, surgiram backends overlay,
`Host()` com barra e entryPoints inválidos. Em paralelo, vários timers/heals
escreviam routing e enviavam HUP, causando 404/502/000 em outros projetos.

O pedido foi criar um **Guardião de Sistemas**, também como Rule, para proteger
todos os projetos atendidos pelo Traefik compartilhado.

## Conceito oficial aplicado

- Install/static (entryPoints/providers) não deve ser misturado com
  routing/dynamic.
- File provider em `directory` carrega múltiplos arquivos e faz hot-reload com
  `watch`; não exige HUP/restart.
- Fontes:
  - https://doc.traefik.io/traefik/getting-started/configuration-overview/
  - https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/

## Implementação

### Motor transacional

`scripts/guardiao-sistemas-traefik-vps.py`

1. Um lock global e um único writer.
2. Aguarda o arquivo estabilizar após rewrite.
3. Exige JSON válido no `main.yaml`.
4. Faz strip de chaves de projeto isolado somente se seu YAML existe e é válido.
5. Normaliza:
   - `web` → `http`;
   - `websecure`/`web-secure` → `https`;
   - `Host(\`dominio/\`)` → `Host(\`dominio\`)`;
   - backend overlay → host gateway somente por allowlist.
6. Monta candidate em memória e valida round-trip.
7. Backup + escrita atômica no mesmo diretório.
8. Aguarda File provider; executa probes locais via `--resolve`.
9. Se um host que estava saudável piorar, restaura baseline automaticamente.
10. Mantém `last-good` somente quando todos os probes estão aceitáveis.
11. Não executa HUP, force ou restart.

### Registry

`scripts/guardiao-sistemas-traefik-registry.json`

- Isolados:
  - Sinal Verde → `sinal-verde.yaml`;
  - Soma CRM → `soma-crm.yaml`.
- Backends allowlist:
  - WABA login `:30180`;
  - paginadevendas `:30210`;
  - Bets `:30211`;
  - Evolution Walkup `:30181`.
- Hosts monitorados: WABA (3), Sinal Verde e Soma CRM.
- Projetos não mapeados são auditados/ignorados; o Guardião não adivinha porta.

### Instalador

`scripts/guardiao-sistemas-traefik-vps.sh`

- `install-audit`: instala serviço em modo somente leitura.
- `activate`: revisa audit, baixa heals publish-only, desativa writers legados
  concorrentes e ativa repair.
- `status`, `audit`, `repair`, `rollback`, `uninstall`.
- Serviço único: `guardiao-sistemas-traefik.service` (daemon, sem timer).

### Heals de aplicação

Alterados para serem **publish-only** e solicitar routing ao Guardião:

- `scripts/heal-paginadevendas-pos-redeploy-vps.sh`
- `scripts/heal-bets-pos-redeploy-vps.sh`
- `scripts/heal-waba-login-vps.sh`

Removidos HUP, patch direto no `main.yaml`, restore amplo e scripts de routing
chamados diretamente.

### Rules

- Projeto: `.cursor/rules/guardiao-sistemas-traefik.mdc`
- Global Cursor: `~/.cursor/rules/guardiao-sistemas-traefik.mdc`
- Atualizadas UCP/entryPoints e `AGENTS.md`.

## Testes

```bash
python -m unittest scripts/tests/test_guardiao_sistemas_traefik.py
python -m py_compile scripts/guardiao-sistemas-traefik-vps.py
bash -n scripts/guardiao-sistemas-traefik-vps.sh
bash -n scripts/heal-paginadevendas-pos-redeploy-vps.sh
bash -n scripts/heal-bets-pos-redeploy-vps.sh
bash -n scripts/heal-waba-login-vps.sh
python -m json.tool scripts/guardiao-sistemas-traefik-registry.json
```

Resultado local: 3 testes OK; Python/Shell/JSON válidos.

## Implantação segura

Não instalado no VPS nesta tarefa. Ordem:

1. Publicar arquivos no Git.
2. `install-audit`.
3. Observar state/diff/probes e inventário real.
4. Ajustar registry se necessário.
5. Só então `activate`.
6. Fazer redeploy controlado de um projeto por vez e comprovar não regressão.

## Segurança e rollback

- Nenhum segredo.
- Não remove serviços/volumes.
- Não reinicia Traefik.
- Backups rotacionados em
  `/etc/easypanel/traefik/config/.guardiao-backups`.
- `rollback` restaura `main.last-good.json` e volta o daemon para audit.

## Palavras-chave

`guardiao-sistemas`, `single writer`, `main.yaml`, `Easypanel rewrite`,
`strip duplicatas`, `sinal-verde.yaml`, `soma-crm.yaml`, `Host barra`,
`entryPoints`, `backend overlay`, `rollback automático`, `sem HUP`
