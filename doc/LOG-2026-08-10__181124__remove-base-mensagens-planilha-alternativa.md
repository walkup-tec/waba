# LOG — Remover base de mensagens (planilha) no Mensageiro Alternativa

## Contexto

Na etapa **6) Mensageiro** (API Alternativa) existia a opção **Usar base de mensagens (planilha)** com upload Excel, mapeamento de colunas e importação. Pedido: excluir esse recurso.

## Solução

1. **UI** (`index.html`): removidos radios de modo, bloco `#dis-db-box`, modal `#dis-mapping-overlay` e fluxos JS de import/download do modelo de mensagens. Mensageiro fica só com geração por IA.
2. **Config**: `messageMode` sempre `"ai"` ao salvar/ler formulário e em `parseDisparosConfig`.
3. **API**: `GET/POST /disparos/templates*` respondem `410` (descontinuado).
4. **Envio**: `composeOutboundMessageForConfig` deixa de usar templates de planilha.

Planilha de **números/leads** da etapa Campanha permanece intacta.

## Arquivos

- `index.html`, `dist/index.html`
- `src/index.ts`, `dist/index.js`
- Worktree: `D:\01A-Drax-Servidor\Waba-master-push`

## Validação

1. Abrir Disparos → API Alternativa → seção Mensageiro.
2. Não deve aparecer “Usar base de mensagens (planilha)” nem upload de Excel de mensagens.
3. Critérios de IA e biblioteca de produtos devem continuar visíveis.

## Segurança

Sem alteração de segredos.

## Palavras-chave

`mensageiro`, `base de mensagens`, `planilha`, `messageMode`, `database`, `templates/import`, `API Alternativa`
