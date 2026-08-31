# LOG — Criação do subagente global traefik-agent

- **Data:** 2026-07-20
- **Contexto:** Criar especialista Traefik disponível em qualquer projeto Cursor, não só WABA.

## Pedido

Criar subagente `traefik-agent` que atue sempre que o problema for Traefik, à disposição de qualquer projeto feito neste Cursor.

## Solução

1. Skill **pessoal/global** (todos os projetos):
   - `C:\Users\Usuario\.cursor\skills\traefik-agent\SKILL.md`
   - `reference.md`, `examples.md`
2. Rule **user** `alwaysApply`:
   - `C:\Users\Usuario\.cursor\rules\traefik-agent.mdc`
3. Atualizado `AGENTS.md` do WABA para apontar `@traefik-agent` como canônico.
4. Skill de repo `traefik-incident-specialist` marcada como **legado** (preferir global).

## Paths de conhecimento citados

- Oficial: `E:\01A-Drax-Servidor\Waba` (REGISTRY / crawler quando presentes)
- Fallback: workspace / Drive Profissional Waba
- **Não** usar path legado `E:\Waba`

## Como validar

- Em qualquer chat Cursor: `@traefik-agent` + sintoma Traefik
- Confirmar que a skill aparece em Skills / é lida ao tratar 404/502 proxy
- Abrir `~/.cursor/skills/traefik-agent/SKILL.md`

## Segurança

- Sem segredos; apenas paths e docs públicas Traefik/Easypanel.

## Palavras-chave

`traefik-agent`, skill global, `~/.cursor/skills`, entryPoints, REGISTRY, crawler, subagente Traefik
