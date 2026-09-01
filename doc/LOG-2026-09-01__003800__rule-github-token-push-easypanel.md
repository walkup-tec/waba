# LOG — Rule + skill para push GitHub automático (GITHUB_TOKEN)

## Contexto

O usuário pediu um subagente ou rule para que, em agentes diferentes, a chave de push
seja identificada e o envio ao GitHub/EasyPanel ocorra automaticamente.

## Decisão

**Rule `alwaysApply`** (não só skill/subagente): lição permanente entra em todo chat.
Skill + script complementam o playbook operacional.

| Artefato | Papel |
|----------|--------|
| `.cursor/rules/waba-github-easypanel-push.mdc` | Enforcement em qualquer agente |
| `.cursor/skills/waba-github-push/SKILL.md` | Playbook detalhado |
| `scripts/git-push-github-master.sh` | Execução segura com `$GITHUB_TOKEN` |
| `sobe-para-o-servidor.mdc` / `AGENTS.md` / `context-autopick.mdc` | Cruzamento |

## Secret

- Nome: `GITHUB_TOKEN`
- Fine-grained: Contents **Read and write** + Metadata Read em `walkup-tec/waba`
- Nunca no chat/repo

## Como validar

1. Novo Cloud Agent com o Secret injetado.
2. Pedido “sobe para o servidor” / deploy EasyPanel.
3. Agente usa `$GITHUB_TOKEN` + script/Rule e tip de `master` no GitHub avança.
