# Push — correção "Falha de conexão com o servidor"

**Data:** 2026-06-30

## Problema

Usuário via mensagem *"Falha de conexão com o servidor. Confira o histórico abaixo…"* ao enviar push, mesmo com envio registrado/concluído.

## Causas

1. Poll do status quebrava no primeiro `Failed to fetch` transitório
2. Entrega pesada (comunidade/e-mail) podia competir com a resposta HTTP
3. Overlay de deploy reagia a 502/503 durante poll e interrompia o fluxo
4. UI não recuperava resultado real do histórico após erro de rede

## Correções

### Backend
- `POST /admin/push/send` responde **202 imediatamente** e dispara entrega em `setImmediate` (fora do handler)
- `acceptPushMessage` só prepara/registra (`sending`); `deliverPushMessageById` separado
- Lock reduzido a `runPreparePushLocked` (dedupe rápido, sem fila atrás da entrega)

### Frontend
- Poll com até 15 retentativas em erro transitório (4 min)
- Fallback: `GET /admin/push/messages/:id` → `GET /admin/push/history`
- Em qualquer erro: `recoverLatestAdminPushFromHistory` e mostra status real (`Enviado`/`Parcial`/`Falhou`)
- Removida mensagem assustadora de "falha de conexão"
- Deploy resilience **não** dispara em rotas `/admin/push/*` durante envio
- Poll também quando status inicial é `sending` (compatibilidade)

## Validar

1. Enviar push Comunidade + E-mail
2. Deve mostrar "Push aceito…" e depois resultado final
3. Se rede oscilar, histórico deve refletir envio sem erro genérico
4. Sem e-mail duplicado em reenvio <90s

## Palavras-chave

`push-connection-recovery`, `poll-resiliente`, `202-setImmediate`, `recoverLatestAdminPushFromHistory`
