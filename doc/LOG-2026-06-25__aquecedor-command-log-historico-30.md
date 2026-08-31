# LOG: Aquecedor — histórico de logs de comando (últimos 30)

## Contexto

Na aba Aquecedor, «Logs de comandos» mostrava **"Nenhum comando executado ainda."** após reload, mesmo com envios/comandos antigos no sistema.

## Pedido

Se não houver log recente na sessão, exibir os **últimos logs realizados**, independente da data — **mínimo 30**.

## Solução

### Backend (`src/index.ts`)

- Arquivo persistido: `data/aquecedor-command-log.json` (até 500 entradas).
- `GET /aquecedor/command-logs?limit=30` — filtro por dono (master vê todos).
- `POST /aquecedor/command-logs` — grava mensagem da UI.
- Gravação automática em: start, stop, run-once, envio com sucesso (`recordAquecedorEnvio`).

### Frontend (`index.html`)

- `loadAquecedorCommandLogHistory()` ao abrir Aquecedor / init.
- Se sessão vazia → exibe histórico persistido (até 30).
- Fallback: se arquivo ainda vazio, monta histórico a partir de `GET /aquecedor/envios?limit=30`.
- `addAquecedorCommandLog` persiste via POST (fire-and-forget).
- Timestamps históricos com data+hora completa (`pt-BR`).

Marker: `DEPLOY-2026-06-25-aquecedor-command-log-history`

## Como validar

1. Redeploy Node + FTP.
2. Abrir Aquecedor sem clicar em nada → painel «Logs de comandos» deve listar envios/comandos anteriores (até 30).
3. Iniciar/pausar/diagnóstico → linhas novas no topo; após F5, histórico mantido.

## Palavras-chave

`aquecedor`, `command-log`, `logs de comandos`, `command-logs`, histórico, 30
