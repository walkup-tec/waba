# LOG — Wizard passo 3: UI travada + fallback conexão EVO

**Data:** 2026-06-30

## Problema

Instâncias **já conectadas na Evolution** (`open`) ficavam com modal **travado no passo 3** (spinner infinito «Aguardando CONFIRMAR»), sem avançar para passo 4 e sem enviar resposta «Validação WABA concluída…».

Causa UX (front): poll falhava em silêncio (404/servidor antigo), linhas de progresso ficavam ocultas, «Pular validação» fechava modal **sem liberar** instância na lista.

## Correção (frontend)

1. **Banner verde** «WhatsApp conectado na Evolution» no passo 3 quando `status-conexao` = open
2. **Checklist visível** desde o início (recepção + resposta em «Processando»)
3. **Poll resiliente**: alterna `?nudge=2` / sem nudge; reinicia sessão em 404; mensagens de erro
4. **Fallback 45s**: se EVO open e CONFIRMAR não concluir → **passo 4** com instância liberada
5. **«Pular validação»** → conclui wizard (passo 4) em vez de fechar e manter instância oculta
6. Timeout 6 min com EVO open → conclui conexão sem travar

Marker: `DEPLOY-2026-06-30-wizard-step3-ux-connection-fallback`

## Validar

1. Deploy + Ctrl+F5
2. QR → conecta → passo 3 mostra banner verde + checklist
3. Sem CONFIRMAR: em ~45s avança para «Instância validada» / conexão liberada
4. Ou «Pular validação» → passo 4 imediato

## Palavras-chave

wizard, passo 3, validação inbound, UI travada, connection fallback, register-instance-overlay
