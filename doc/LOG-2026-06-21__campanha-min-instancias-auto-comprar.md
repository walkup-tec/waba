# LOG — Campanha: mínimo 4 instâncias + «+ Instâncias» automático

## Contexto

Pedido do usuário: quando a campanha não tiver números conectados suficientes (mínimo 4), o sistema deve:

1. Buscar instâncias disponíveis no aquecedor do assinante **ou** nos números comprados/ativados.
2. Adicionar automaticamente a quantidade mínima necessária ao clicar em «+ Instâncias».
3. Exibir **mensagem + botão «+ Instâncias» somente** quando `needsMoreInstancesForMinimum === true`.
4. Se não houver disponíveis, orientar o usuário a **comprar números** (aba Comprar).

## Solução implementada

### Backend (`src/index.ts`, `src/disparos/alternativa-dispatch-rules.ts`)

- Constante `DISPAROS_CAMPAIGN_MIN_CONNECTED_INSTANCES = 4`.
- `getCampaignInstanceHealth()` expõe `needsMoreInstancesForMinimum`, `missingConnectedForMinimum`, `minConnectedRequired`.
- `resolveAutoInstancesForCampaign()`: prioriza números comprados conectados, depois aquecedor conectado; exclui já na campanha.
- `POST /disparos/campanhas/:id/instancias` com `{ auto: true }` adiciona automaticamente; `409` + `code: buy_numbers_required` se vazio.
- Pausa automática e bloqueio de ativação quando abaixo do mínimo.
- Fix GET campanhas: `configByCampaignId.get(item.id)` em vez de `item.configSnapshot`.

### Frontend (`index.html`)

- Alerta: «Quantidade mínima para campanha = N números» só quando `needsMoreInstancesForMinimum`.
- Botão «+ Instâncias» só nesse caso; «Ativar campanha» desabilitado.
- `addInstancesToCampaign()` → `POST { auto: true }`.
- Em `buy_numbers_required` ou `needsPurchase`: toast + `goToDisparosBuyNumbersPanel()` (aba Comprar).

## Arquivos alterados

- `D:\Waba-master\src\disparos\alternativa-dispatch-rules.ts`
- `D:\Waba-master\src\index.ts`
- `D:\Waba-master\index.html`

## Validação

```powershell
cd D:\Waba-master
npm run build   # OK
```

Teste manual V02 (`http://localhost:3012/version-02/`):

1. Campanha com &lt; 4 conectados → mensagem + «+ Instâncias» visíveis.
2. Clique «+ Instâncias» com disponíveis no aquecedor/comprados → números adicionados ao snapshot.
3. Sem disponíveis → toast + aba Comprar.
4. Com 4+ conectados → mensagem e botão **não** aparecem.

## Palavras-chave

`needsMoreInstancesForMinimum`, `resolveAutoInstancesForCampaign`, `buy_numbers_required`, `DISPAROS_CAMPAIGN_MIN_CONNECTED_INSTANCES`, `+ Instâncias`, `auto: true`
