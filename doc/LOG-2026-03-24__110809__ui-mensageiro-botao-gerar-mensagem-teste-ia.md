# Log: UI Mensageiro - botao de gerar mensagem teste IA

## Contexto do pedido
Na secao "Mensageiro" nao havia opcao visual para testar a geracao da mensagem com IA, apesar do endpoint backend ja existir.

## Comandos / acoes executadas
- Alteracao de UI e JS em `index.html`
- `npm run build`

## Solucao implementada (passo a passo)
1. Adicionado botao no bloco de IA da secao Mensageiro:
   - `Gerar mensagem teste (IA)`
2. Adicionado status visual da geracao:
   - `#dis-ai-test-status`
3. Adicionada area para visualizar a mensagem gerada:
   - `#dis-ai-test-output` (textarea readonly)
4. Implementada funcao `testDisparosAiGeneration()` no frontend:
   - valida se modo IA esta ativo
   - monta briefing com os campos da tela
   - chama `POST /disparos/gerar-mensagem-ai`
   - renderiza texto gerado, modelo e latencia
5. Registrado listener do botao:
   - `#dis-test-ai-generate-btn`

## Arquivos criados/alterados
- Alterado: `index.html`
- Criado: `doc/LOG-2026-03-24__110809__ui-mensageiro-botao-gerar-mensagem-teste-ia.md`

## Como validar
1. Abrir aba Disparos > secao `6) Mensageiro`
2. Manter opcao `Gerar mensagens com IA` marcada
3. Clicar em `Gerar mensagem teste (IA)`
4. Confirmar:
   - status verde de sucesso
   - mensagem preenchida em `Mensagem gerada`

## Observacoes de seguranca
- Fluxo usa endpoint backend, mantendo `OPENAI_API_KEY` somente no servidor.
- Nenhum segredo e exposto no frontend.

## Itens para evitar duplicacao no futuro (palavras-chave)
- mensageiro-gerar-mensagem-teste
- disparos-ui-openai
- dis-test-ai-generate-btn
