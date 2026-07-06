# LOG — Push comunidade: instância admin 5181077770

**Data:** 2026-06-29

## Pedido

Corrigir texto/config: admin da comunidade é **5181077770**, não 5181076973.

## Alterações

- Default `WABA_PUSH_COMMUNITY_*` → `Drax Sistemas 5181077770` / hint `5181077770`.
- `LEGACY_WRONG_PUSH_COMMUNITY_INSTANCES`: migra `drax sistemas 5181076973` (e `walkup`) para o default correto em `waba-push-config.json`.
- Score por **número WhatsApp** na Evolution (ex.: `drax-oficial` com `555181077770`).
- UI fallback admin push → `Drax Sistemas 5181077770`.
- Mantém label `5181077770` no config mesmo se a Evolution usar outro nome técnico (`drax-oficial`).

## Validar

1. Redeploy Easypanel → `/health` marker `DEPLOY-2026-06-29-push-comunidade-instancia-7770`.
2. Admin → Push → Comunidade: instância **Drax Sistemas 5181077770**.

## Palavras-chave

`5181077770`, `5181076973`, push comunidade, communityEvoInstance
