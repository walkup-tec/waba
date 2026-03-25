# LOG: Disparador — botão Diagnóstico no painel Campanhas

## Pedido

Botão de diagnóstico no Disparador (lado direito, junto à lista de campanhas), no estilo do Aquecedor, para informações de envio.

## Implementação

- **GET `/disparos/diagnostico`**: horário de referência (BR), `isDisparosWindowOpen` (expediente da config salva), resumo de config (delays, limites/h·dia, modo mensagem, contagem de instâncias na UI, WhatsApp mascarado), consulta **EVO** (instâncias conectadas elegíveis para Disparador, mesmo critério de seleção da UI), campanhas **running** na memória com pendentes/falhas/próximo slot de envio (~tick 7s), contagem de templates em memória (modo planilha).
- **UI**: botões **Diagnóstico** e **Atualizar** no título “Campanhas”; bloco **Log de diagnóstico** abaixo da lista (reusa estilos `aquecedor-command-log`).

## Arquivos

- `src/index.ts`, `index.html`

## Segurança

- WhatsApp alvo só últimos 4 dígitos (ou “definido”); sem tokens.

## Palavras-chave

- `/disparos/diagnostico`, dis-messenger (n/a), `isDisparosWindowOpen`, `disparos-diagnostico-btn`
