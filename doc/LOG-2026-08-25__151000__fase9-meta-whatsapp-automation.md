# LOG — Fase 9 automação/chatbot Meta Cloud API

Data: 2026-08-25 15:10

## Contexto

Fases 7 e 8 aprovadas e SQL aplicado. Pedido: camada de automação sobre inbound Meta (boas-vindas, palavras-chave, menu, horário comercial, human takeover, rate limit, janela 24h), sem IA, sem alterar Evolution/aquecedor/campanhas/fornecedor/Asaas/LAB legado.

## Ações

- SQL em `doc/SQL-2026-08-25__create-meta-whatsapp-automation.sql` (settings, flows, rules, runs; RLS; sem tokens).
- Engine `MetaWhatsappAutomationEngine` assina `inbound_message` (não o webhook HTTP).
- `RulesResponder` (contrato `AutomationResponder`; `AIResponder` stub sem modelo).
- CRUD autenticado `/integrations/meta/whatsapp/automation*`.
- UI Laboratório → Automação (`whatsapp-automation`).
- Testes `npm run test:meta-phase9` (20/20). Regressão phase6 21/21 e phase8 12/12.

## Política de matching

`first_matching_rule_wins` — a primeira regra ativa, ordenada por `priority` ASC, é executada.

## Como validar

1. Aplicar o SQL no Supabase.
2. `npm run test:meta-phase9`
3. Laboratório → Automação: ativar, criar FIRST_INBOUND / EXACT_TEXT / ANY_INBOUND.
4. Enviar inbound real na WABA e conferir Inbox + tabela `meta_whatsapp_automation_runs`.

## Segurança

Sem tokens nos logs/DTOs. Tenant só pela sessão. Template só do mesmo tenant/conexão/WABA aprovado.

## Palavras-chave

fase9, automation, chatbot, human_takeover, meta-cloud, first_matching_rule_wins
