# Log: Mensageiro sem input de URL e link via Encurtador

## Contexto do pedido
Remover input manual de URL na secao Mensageiro e usar exclusivamente as informacoes da secao "Encurtador de URL" para gerar link curto e incluir na mensagem teste.

## Comandos / acoes executadas
- Ajuste frontend em `index.html`
- Ajuste backend em `src/index.ts`
- `npm run build`
- checagem de lints

## Solucao implementada
1. Frontend:
   - Removido campo `URL de acesso (para encurtar no teste)` da secao Mensageiro.
   - Requisicao de teste IA nao envia mais `accessUrl`.
2. Backend:
   - `POST /disparos/gerar-mensagem-ai` agora gera URL base automaticamente a partir do numero configurado em `whatsappTargetNumber` (secao Encurtador).
   - Fluxo:
     - monta URL base `https://wa.me/{numero}?text=Olá`
     - encurta com provider configurado
     - inclui o link curto na mensagem final

## Arquivos alterados
- `index.html`
- `src/index.ts`

## Como validar
1. Em Encurtador de URL, informar numero alvo e salvar configuracao.
2. Em Mensageiro, clicar em `Gerar mensagem teste (IA)`.
3. Confirmar mensagem retornada com link curto, sem precisar informar URL manual.

## Palavras-chave
- remover-input-url-mensageiro
- encurtador-config-link-automatico
- gerar-mensagem-ia-com-wa-me
