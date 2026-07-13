# LOG — Agente Traefik Incidentes no Cursor

**Data:** 2026-07-13 ~14:57 BRT

## Contexto

Criar agente Cursor que, em desconexões causadas por Traefik, consulta a base de URLs (50k) + docs oficiais, aplica correção definitiva e registra a causa para evolução contínua.

## Entregues

| Artefato | Path |
|----------|------|
| Skill | `.cursor/skills/traefik-incident-specialist/SKILL.md` (+ reference, examples) |
| Rule | `.cursor/rules/traefik-incident-agent.mdc` |
| Registro causas | `doc/traefik-causes/REGISTRY.md` |
| Busca RAG | `scripts/traefik-kb-search.py` |
| Índice agentes | `AGENTS.md` atualizado |
| Espelho E: | `E:\Waba\.cursor\...`, `E:\Waba\scripts\`, `E:\Waba\doc\traefik-causes\` |

## Validação

```powershell
py -3 E:\Waba\scripts\traefik-kb-search.py entryPoints websecure --limit 5 --prefer doc.traefik.io
# EXIT 0 — hits em doc.traefik.io
```

## Como usar

```
@traefik-incident-specialist <sintoma>
```

## Palavras-chave

`traefik-incident-specialist`, `REGISTRY`, `kb-search`, `desconexão`, `RAG`, `correção definitiva`
