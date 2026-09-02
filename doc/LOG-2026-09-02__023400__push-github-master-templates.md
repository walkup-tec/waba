# LOG — Push único GitHub master (templates)

## Contexto

Pedido: subir tudo num push só para o usuário fazer o Redeploy com todas as atualizações do laboratório de templates.

## O que foi para `walkup-tec/waba` `master`

Um push fast-forward a partir de `0d02647` incluindo:

- tabela de todos os portfólios, filtros e tags;
- IA Utility (léxico, few-shot, molde da biblioteca);
- Visualizar = modal Seu modelo;
- Excluir = DELETE Graph (`hsm_id` + `name`) + registro local;
- Atualizar da Meta = prune do órfão local após listagem completa.

Marker no `dist/`: `DEPLOY-2026-09-02-023200-sync-prune-templates`.

## Como validar após o Redeploy EasyPanel

```bash
curl -sS https://waba.draxsistemas.com.br/health
```

O `deployMarker` deve ser `DEPLOY-2026-09-02-023200-sync-prune-templates`.

## Observações

Redeploy do `waba_disparador` é do usuário. Login pode 502 ~1 min até o heal v6 republicar `:30180`.

## Palavras-chave

github, master, push, EasyPanel, templates, prune
