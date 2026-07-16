# LOG — Aquecedor continua após logout

**Data:** 2026-07-16 15:49  
**Pasta de trabalho:** `H:\Meu Drive\Drive Profissional\Waba` (mais atual que `D:\Waba`, 14/07 vs 06/07)  
**Marker:** `DEPLOY-2026-07-16-aquecedor-continua-apos-logout`

## Contexto

Com ≥2 números integrados e aquecedor **Iniciado**, ao deslogar o usuário o envio de mensagens parava. O motor deve ser daemon de servidor: independente de sessão HTTP.

## Causa raiz

1. `shouldProcessLeadOwnerMotor` exigia `snapshot.running === true` além de `desired === true`.
2. Persistência gravava `running` a partir de `runtime.running` (timer local). Reload/sync podia zerar o timer → `running=false` no disco com `desired=true`.
3. Leadership parava o timer local nesses casos e **não retomava**.
4. A UI (só com login) fazia auto-resume via `POST /aquecedor/start`. Sem sessão, ninguém resgatava o motor.

Logout em si **não** chama `/aquecedor/stop` — o bug era o motor “morrer” e só a sessão logada o reviver.

## Correção

- `shouldProcessLeadOwnerMotor`: só `desired=true` + lease do worker.
- `buildPersistedSnapshotFromMotor`: com `desired=true`, força `running=true` (salvo override explícito no stop).
- Reload do `runtime-intent.json`: **merge** (não `clear` do Map) — preserva timer local do líder.
- `syncAquecedorWorkerLeadership` + fim de ciclo: reafirmam `running: true` quando este processo lidera.

## Arquivos

- `src/services/aquecedor-owner-runtime.registry.ts`
- `src/index.ts`
- `src/deploy-marker.ts`

## Como validar

1. Login → integrar ≥2 instâncias no Aquecedor → **Iniciar**.
2. Confirmar envios no painel/logs.
3. **Sair** (logout) e fechar o browser.
4. Aguardar 1–2 ciclos: mensagens devem continuar (EVO / `aquecedor-envios-log` / Supabase).
5. Só **Pausar Aquecedor** (logado) deve parar de verdade (`desired=false`).

## Keywords

`aquecedor`, `logout`, `desired`, `runtime-intent`, `shouldProcessLeadOwnerMotor`, `snapshot.running`, `daemon`
