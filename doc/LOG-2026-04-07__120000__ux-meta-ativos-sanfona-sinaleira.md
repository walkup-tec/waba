# LOG: UX Meta Ativos - sanfona por etapa com sinaleira

## Contexto do pedido

A tela "API Meta - Ativos" estava com excesso de informacao visivel ao mesmo tempo. Foi solicitado:
- remover numeracao como destaque principal das etapas;
- usar sinaleira visual (verde/amarelo/vermelho);
- exibir etapas seguintes apenas quando a anterior estiver concluida;
- adotar comportamento em sanfona.

## Solucao implementada

1. Criado layout em cards por etapa com cabecalho clicavel:
   - etapa 1: Conectar com a Meta;
   - etapa 2: Integracao API oficial;
   - etapa 3: Integrar numeros WhatsApp.
2. Cada cabecalho ganhou:
   - bolinha de status (pendente, aviso, sucesso, erro);
   - texto de estado da etapa.
3. Comportamento de sanfona:
   - etapa 1 abre por padrao;
   - etapa 2 fica bloqueada ate etapa 1 concluir;
   - etapa 3 fica bloqueada ate etapa 2 concluir;
   - somente a etapa ativa/pendente fica expandida automaticamente.
4. Regras de progresso ligadas ao estado existente do fluxo:
   - etapa 1: `integrationConnected` ou credenciais (token + WABA) presentes;
   - etapa 2: concluida quando numeros foram listados (`phoneListed`);
   - etapa 3: concluida com numero registrado e app inscrito.
5. Erro de configuracao destaca a etapa atual em vermelho.

## Arquivos alterados

- `index.html` (markup + CSS + comportamento JS da sanfona/sinaleira)
- `dist/index.html` (gerado no build)

## Validacao rapida

1. Abrir aba `API Meta - Ativos`.
2. Confirmar:
   - etapa 1 aberta;
   - etapa 2/3 bloqueadas inicialmente.
3. Preencher/concluir etapa 1 e verificar abertura da etapa 2.
4. Executar listagem na etapa 2 e verificar abertura da etapa 3.
5. Forcar erro de etapa e validar sinaleira vermelha.

## Seguranca

Sem mudanca de credenciais/segredos; ajuste apenas de UI e estados visuais.

## Palavras-chave

`ux`, `sanfona`, `sinaleira`, `meta-ativos`, `embedded-signup`, `etapas`
