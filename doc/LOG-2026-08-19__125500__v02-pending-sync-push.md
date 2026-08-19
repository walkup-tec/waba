# V02 — sync e push do trabalho pendente local

## Contexto

Branch `v02` estava 121 commits atrás de `origin/v02`, com alterações locais não commitadas (aquecedor, inbound validation, admin snapshot, WA connecting restriction, etc.).

## Ações

1. `git pull origin v02` após stash do working tree.
2. Resolução de conflitos do stash (sem commitar credenciais em `.env.v02.example`).
3. Inclusão de `whatsapp-connecting-restriction.service.ts` (paridade com master).
4. `npm run build` — TypeScript + `dist/index.html`.
5. Commit e `git push origin v02`.

## Arquivos principais

- `src/index.ts`, `src/instance-inbound-validation.service.ts`, `src/aquecedor/`
- `src/instances/whatsapp-connecting-restriction.service.ts`
- `src/admin/waba-admin-data-snapshot.service.ts`
- `index.html`, `dist/`, `doc/`, `scripts/`

## Segurança

- Credenciais CASA do CADASTRO **não** incluídas no commit.
- `AWS Server/*.pem` e pastas `.tmp-*` / `.tools/` fora do commit.

## Palavras-chave

v02, pending-sync, aquecedor, whatsapp-connecting-restriction, data-snapshot
