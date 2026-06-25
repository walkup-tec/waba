# LOG — Wizard Nova campanha sem Plano de envio (sempre API Oficial)

**Data:** 2026-06-25  
**Contexto:** Com a separação dos menus de campanhas API Oficial e API Alternativa, o passo 5 (Leads) do wizard em Disparos não precisa mais do seletor "Plano de envio".

## Pedido

Remover a opção de escolha entre API Oficial e API Alternativa na tela Nova campanha. Campanhas criadas nesse fluxo devem ser sempre **API Oficial**.

## Solução

1. **HTML** — removidos `#dis-wizard-plan-wrap`, radios `dis-wizard-api-kind`, mensagem implícita e projeção alternativa.
2. **CSS** — removidos estilos `.dis-wizard-plan-*`.
3. **JS** — `getDisCampaignWizardSelectedApiKind()` retorna sempre `"oficial"`; saldo/validação usa apenas bucket oficial; submit envia `apiKind: "oficial"`; removidas funções de seleção de plano e listeners dos radios.

## Arquivos alterados

- `index.html`
- `dist/index.html` (via `npm run build`)

## Como validar

1. Abrir aba **Disparos** → **Nova campanha**.
2. Avançar até o passo **5. Leads**.
3. Confirmar que não aparece "Plano de envio".
4. Importar planilha e gerar campanha — payload deve usar API Oficial; saldo validado contra créditos oficiais.

## Palavras-chave

`dis-wizard-plan-wrap`, `getDisCampaignWizardSelectedApiKind`, `nova-campanha`, `api-oficial`, `wizard-leads`
