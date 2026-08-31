# Log: Campanhas de Disparos com importacao Excel e progresso

## Contexto do pedido
Transformar as configuracoes do Disparador em campanha, permitindo:
- nome da campanha
- importacao de numeros via planilha Excel
- persistencia no banco por campanha
- listagem lateral de campanhas com data de inicio, nome e barra de progresso

## Comandos / acoes executadas
- Alteracoes backend em `src/index.ts`
- Alteracoes frontend em `index.html`
- `npm run build`
- checagem de lints

## Solucao implementada (passo a passo)
1. Backend:
   - Adicionados modelos em memoria para campanhas e leads.
   - Novo endpoint `POST /disparos/campanhas`:
     - recebe `name`, `numbers[]` e `configSnapshot`
     - normaliza/deduplica numeros
     - salva campanha e base no Supabase (`disparos_campaigns`, `disparos_campaign_leads`) com fallback em memoria
   - Novo endpoint `GET /disparos/campanhas`:
     - retorna lista com `createdAt`, `name`, `totalNumbers`, `sentCount` e `progressPercent`
2. Frontend:
   - Nova secao `7) Campanha` com:
     - `Nome da campanha`
     - upload de planilha Excel de numeros
     - botao `Mapear coluna e criar campanha`
   - Novo modal de mapeamento da campanha:
     - seleciona coluna do numero
     - cria campanha chamando `POST /disparos/campanhas`
     - envia snapshot das configuracoes atuais via `getDisparosFormValues()`
3. Painel lateral:
   - Substituido para listar campanhas
   - mostra:
     - nome da campanha
     - data de inicio
     - progresso `sentCount/totalNumbers`
     - barra grafica de evolucao

## Arquivos criados/alterados
- Alterado: `src/index.ts`
- Alterado: `index.html`
- Criado: `doc/LOG-2026-03-24__121534__campanhas-disparos-criacao-importacao-progresso.md`

## Como validar
1. Reiniciar backend.
2. Em Disparos, preencher as configuracoes desejadas.
3. Em `7) Campanha`:
   - informar nome
   - selecionar Excel
   - mapear coluna de numero
   - criar campanha
4. Confirmar:
   - status de criacao
   - campanha aparecendo na lateral com barra de progresso

## Observacoes de seguranca
- Sem exposicao de chaves/tokens.
- Validacao de entrada para nome e numeros.
- Mensagens de erro seguras no retorno da API.

## Itens para evitar duplicacao no futuro (palavras-chave)
- campanhas-disparos
- disparos-campaigns
- importacao-excel-numeros
- progresso-campanha
