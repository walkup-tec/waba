# Atendimento em três colunas

## Contexto

Reorganização da tela com base na referência enviada: Números, Contatos e Conversa.
Os dados do contato ficam ocultos para preservar espaço e aparecem sob demanda.

## Solução

- Coluna **Números** com todos os números oficiais cujo Inbox está ligado.
- Coluna **Contatos** com busca, filtros e conversas recebidas.
- Coluna **Conversa** com histórico e envio de mensagens.
- Botão **Dados do contato** abre um painel lateral sobreposto e recolhível.
- O acionador é um ícone circular discreto de cadastro/contato, com tooltip e
  rótulo acessível para leitores de tela.
- O painel reúne origem, telefone receptor, janela de atendimento, status,
  responsável, ações e envio por template.
- Em telas menores, números e contatos precedem a conversa; ao abrir um contato,
  a conversa ocupa a tela e mantém o botão Voltar.

## Arquivos alterados

- `index.html`
- `dist/index.html`
- `src/deploy-marker.ts`
- `dist/deploy-marker.js`

## Validação

- `npm run build`
- Validação visual desktop e viewport mobile.
- Selecionar número, contato, abrir/fechar dados do contato e voltar à lista.
- Preview local direto, sem login: `/?ui-preview=atendimento`.
- O preview só é aceito em `localhost` ou `127.0.0.1` e usa dados fictícios;
  não cria uma rota de bypass em produção.

## Segurança

Nenhum token ou segredo foi exposto. O painel mostra apenas dados já retornados
pela API autenticada do Atendimento.

## Palavras-chave

atendimento, três colunas, números, contatos, conversa, painel do contato, drawer
