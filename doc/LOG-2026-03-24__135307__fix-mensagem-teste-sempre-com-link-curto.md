# Log: Fix mensagem teste sempre com link curto

## Contexto
Mensagem teste IA estava sendo gerada sem URL final em alguns cenarios.

## Solucao aplicada
- Backend `POST /disparos/gerar-mensagem-ai` agora:
  - exige numero alvo valido (da configuracao ou enviado no request)
  - gera URL `wa.me` e encurta obrigatoriamente
  - se nao conseguir gerar link curto, retorna erro (nao gera mensagem sem link)
- Frontend:
  - envia `whatsappTargetNumber` atual da tela para o backend no teste IA

## Arquivos alterados
- `src/index.ts`
- `index.html`

## Validacao
- `npm run build` concluido
- lints sem erros

## Palavras-chave
- mensagem-teste-com-link
- encurtador-obrigatorio
- disparos-gerar-mensagem-ai
