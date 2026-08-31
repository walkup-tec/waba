# LOG — Deploy Easypanel chamados todos usuários

**Data:** 2026-07-10 13:08

## Solicitação
Fazer deploy no Easypanel da feature de criar chamado para todos os usuários.

## Ações
1. Commit só dos arquivos da feature (src + dist + index + doc).
2. Amend assunto com SHA para o painel Easypanel: `[a331459] feat: permitir criar chamado para todos os usuarios`
3. `git push origin master` → `4c3f0d6..d8e2aaf`

## Resultado
- Commit publicado: `d8e2aaf` (assunto com `[a331459]`)
- Marker: `DEPLOY-2026-07-10-chamados-todos-usuarios`
- Easypanel deve puxar `master` e rebuildar `waba_disparador` (se auto-deploy estiver ligado; senão Redeploy manual).

## Validar em produção
1. Maker/Easypanel: deploy com título contendo `[a331459]` / commit `d8e2aaf`
2. `GET /health` → marker `DEPLOY-2026-07-10-chamados-todos-usuarios`
3. Master: botão Criar chamado em Suporte · Chamados
4. Assinante/operacional/suporte: FAB `?`

## Fora do commit
Alterações locais não relacionadas (`.env.v02.example`, `package.json`, scripts purge, etc.) permaneceram unstaged.
