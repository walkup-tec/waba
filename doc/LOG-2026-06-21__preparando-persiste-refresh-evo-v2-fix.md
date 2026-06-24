# LOG — Preparando persiste após patch JSON (refresh EVO)

## Contexto
Usuário aplicou patch JSON no VPS; após reiniciar navegador, `5182006011` continua **Preparando**.

## Causa raiz (confirmada)
1. Aba Instâncias dispara `/instancias?refresh=1` em background (~300ms).
2. `saveEvoInstancesCache` **substitui** `evo-instances-cache.json` com `createdAt` recente da EVO.
3. Patch anterior só alterava lifecycle — **apagado no refresh**.
4. Container em produção ainda roda **JS antigo** (sem `manualActiveOverride` / `enforceManualActiveOverride`).
5. `GET /instancias/uso-config` chama `reconcileGrandfatheredActiveRow` → **active → preparing** a cada visita.

## Fix
- `readEvoInstanceCreatedAt`: se `manualActiveOverride`, ignora EVO e usa data legado.
- `saveEvoInstancesCache`: preserva `createdAt` para instâncias com override.
- Script VPS v2: patch in-place no JS do container + JSON + restart + verificação.
- `scripts/vps-fix-preparing-v2.sh`

## Validar no VPS
```bash
bash vps-fix-preparing-v2.sh
# deve imprimir phase: active e statusLabel: null
```

## Palavras-chave
refresh=1, saveEvoInstancesCache, reconcile, manualActiveOverride, 5182006011
