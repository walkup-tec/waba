# LOG — Wizard etapa 3: outro WhatsApp

**Data:** 2026-06-08  
**Pedido:** Substituir "celular de referência" por linguagem de "outro WhatsApp (não o que está integrando)" na etapa 3 do wizard Conectar instância.

## Arquivos alterados
- `index.html` — lead, instruções, spinner, constantes JS, mensagens de timeout/incompleto
- `src/instance-inbound-validation.service.ts` — detalhes de status da API

## Textos novos (resumo)
- Lead: *Use outro WhatsApp (não pode ser o que você está integrando)*
- Passo 1: *No outro WhatsApp, abra o chat com {número}*
- Espera: *Aguardando envio de CONFIRMAR pelo outro WhatsApp (não o que está integrando)…*
- Pós-recepção: *Aguardando resposta automática do número integrado…*

## Pendências
- `npm run build` para atualizar `dist/`
- Deploy se solicitado
