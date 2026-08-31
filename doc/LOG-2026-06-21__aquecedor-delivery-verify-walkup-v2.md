# LOG — Aquecedor: erro entrega walkup (findMessages v2)

**Data:** 2026-06-21  
**Marker:** `DEPLOY-2026-06-21-aquecedor-delivery-verify-v2`

## Sintoma (produção)

Log de comandos:
`Detalhe EVO: HTTP 201 | instance: walkup | ... EVO aceitou o envio, mas a mensagem não apareceu no WhatsApp do destinatário (conferência findMessages).`

Deploy anterior (`DEPLOY-2026-06-21-aquecedor-fila-multi-instancia`) já estava ativo.

## Interpretação

- **Não é regressão da fila multi-instância** — é a verificação de entrega real (introduzida em 2026-06-20) bloqueando falso sucesso.
- EVO retornou **201**, mas `findMessages` na instância **destino** (`walkup`) não achou a tag/mensagem no WhatsApp do destinatário.
- Possíveis causas: instância walkup desconectada, restrição Meta, mensagem presa só na origem, ou falso negativo do findMessages.

## Correção

**Arquivo:** `src/index.ts`

- `verifyAquecedorMessageDelivered` v2:
  - candidatos de nome EVO (alias + técnico)
  - filtro por timestamp (`sendStartedAtMs`) e `fromMe: false` no destino
  - mais variantes de `remoteJid` (sufixo 10 dígitos BR)
  - 12 tentativas × 3s
  - se achar só na **origem** (`fromMe: true`), mensagem explícita: «Mensagem apareceu só na origem…»

## Validar

1. Deploy + `/health` marker novo.
2. Reiniciar aquecedor.
3. Se erro persistir só em `walkup`: checar conexão QR, probe integração, `use_aquecedor` no Supabase.

## Palavras-chave

`findMessages`, `walkup`, `delivery-verify`, `HTTP 201`, `falso sucesso`
