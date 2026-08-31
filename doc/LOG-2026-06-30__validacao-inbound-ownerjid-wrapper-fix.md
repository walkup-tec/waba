# LOG — Validação inbound: ownerJid no wrapper Evolution + resolução agressiva

**Data:** 2026-06-30  
**Marker:** `DEPLOY-2026-06-30-validacao-inbound-ownerjid-wrapper-fix`

## Contexto

Passo 3 do wizard ainda mostrava `—` após deploy `b2bb1c8`. Causa raiz: na Evolution v2, `ownerJid` fica no **objeto pai** da listagem (`fetchInstances`), não dentro de `instance`. O código lia só `item.instance`, ignorando o telefone.

## Solução

### Novo `src/instances/evo-instance-phone.service.ts`

- `extractPhoneFromEvoListItem` — merge wrapper + `instance`
- `resolveEvoInstancePhone` — fetchInstances → connectionState → fetchProfile → cache → hint
- `isEvoInstanceOpen`

### Backend

- `status-conexao` retorna `instanceNumber` (EVO + Supabase `controle_instancia`)
- `startInboundValidation` usa `resolveEvoInstancePhone`
- `/instancias` e `buildConnectedFromEvoResponse` usam extração corrigida

### Frontend

- `registerConnectedInstanceNumber` em cache durante o wizard
- Poll `status-conexao` grava número antes do passo 3
- `rememberRegisterConnectedNumber` em QR/validação

## Validar

1. Redeploy Easypanel
2. `GET /health` → marker novo
3. `GET /instancias/atendimento-6019/status-conexao` com instância open → `instanceNumber` preenchido
4. Passo 3 wizard → número formatado visível

## Palavras-chave

ownerJid wrapper, fetchInstances, evo-instance-phone, status-conexao instanceNumber
