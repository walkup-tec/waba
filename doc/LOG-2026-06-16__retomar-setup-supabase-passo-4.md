# LOG — Retomar setup Supabase WABA (passo 4)

**Data:** 2026-06-16

## Contexto
- Projeto Supabase DEV: `wcexaxeenvuigktyomdq`
- Passos 1–3 concluídos: service_role no `.env`/`.env.v02`, SQL completo rodado, `npm run dev:v02` OK
- Passo 4 interrompido por Evolution API 404 (Traefik sem router no `main.yaml`)

## Evolution / Traefik (resolvido no VPS)
- Restore `main.yaml` de `main.yaml.bak-1780424037`
- `traefik-permanent-walkup-evo-vps.sh run` → `evo_public:200` `evo_fetch:401`
- `traefik-permanent-waba-vps.sh run` → `waba:200` `health:200`

## Próximo passo
**Passo 4 de 8:** testar Aquecedor no painel local (`Aquecedor → Pausar → Iniciar`), validar fila/envios no Supabase.

## Pendências setup BD (5–8)
- Confirmar tabelas no Table Editor
- Validar registros em `aquecedor`, `logs_envios`, `aquecedor_config`
- Instâncias com `use_aquecedor` no painel
- Disparos/dashboard `/dados` com banco novo
