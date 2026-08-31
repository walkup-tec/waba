## Contexto do pedido

Corrigir o indicador de **Conversão (cliques)** no relatório de campanha:
- usuário clicou 4x no link e o relatório voltou **0**
- e o gráfico de barras não estava exibindo a conversão.

## Acoes executadas

1. Validacao da resposta real da API do EncurtadorPro para `?short=...`:
   - foi observado que o payload retorna `data.clicks` (e nao `payload.clicks`).
2. Corrigido o parser `parseEncurtadorProClicks` para ler corretamente `payload.data.clicks`.
3. Corrigido o calculo da conversao no endpoint:
   - conversao = `totalCliques / enviadosComSucesso`
   - `totalCliques` agora soma cliques por **shortUrl unico** (evita overcount).
4. Incluida a conversao como item no `funnel` para renderizar no **gráfico de barras**.
5. Ajustado o texto na UI do funnel quando `row.isConversion=true`.

## Arquivos alterados

- `src/index.ts`
- `index.html`
- `doc/memoria.md`
- `doc/LOG-2026-03-26__170406__conversao-relatorio-encurtadorpro-fix.md` (novo)

## Como validar

1. Reiniciar o servidor Waba para carregar o `dist/` atualizado:
   - `npm start`
2. Rodar um disparo e abrir:
   - `Relatório` da campanha
3. Confirmar:
   - card “Conversão (cliques)” com valor > 0 quando houver cliques no EncurtadorPro
   - barra “Conversão (cliques)” aparecendo no funnel.

## Observacoes de seguranca

- Nenhuma chave/tokens foram logados.
- Chamadas ao EncurtadorPro seguem utilizando `ENCURTADORPRO_API_KEY` via ambiente.

## Palavras-chave

- conversao-relatorio
- encurtadorpro-clicks
- funnel-conversao
