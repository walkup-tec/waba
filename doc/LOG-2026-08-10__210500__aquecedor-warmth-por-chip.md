# LOG — Aquecedor warmth por chip + identidade chip (deploy)

## Contexto

1. Lógica de envio/grafo deve usar número do chip, não nome da instância.
2. Foguinhos (warmth) de `5181076973` e `5181082477` estavam subestimados por rename + janela 7d + teto de média.

## Solução

### Identidade chip (envio)
- `aquecedor-chip-identity.ts`, grafo `identityMode=chip`, turn manager e stats por chip.

### Warmth
- Alias por chip (`controle` + cache EVO + aliases + descoberta histórica por token, excluindo nomes de outro chip).
- Idade = min(lifecycle.activatedAt, 1ª atividade do chip).
- Média = max(7d, vitalícia); sem teto superior nas faixas.
- Pisos por volume vitalício (150/300/700).
- Lifecycle: backdate `activatedAt` quando histórico do chip é mais antigo.

## Marker

`DEPLOY-2026-08-10-aquecedor-warmth-por-chip`

## Validação

- `npm run build` ok
- `node scripts/test-aquecedor-warmth-chip.cjs` ok (níveis esperados para perfis 6973/82477)

## Palavras-chave

warmth, chip, 5181076973, 5181082477, foguinhos, identidade-chip, deploy
