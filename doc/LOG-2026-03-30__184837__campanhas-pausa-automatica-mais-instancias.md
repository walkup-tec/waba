# LOG — Campanhas: pausa automática e botão + Instâncias

## Contexto

Solicitado criar regra de segurança para campanhas ativas: pausar quando mais de 50% das instâncias selecionadas estiverem desconectadas, com ação para adicionar instâncias e reativar campanha depois.

## Implementação

1. Backend (`src/index.ts`):
   - Criado `CampaignInstanceHealth` e `getCampaignInstanceHealth`.
   - `runCampaignDispatchTick` agora pausa campanha `running` automaticamente quando desconexão de instâncias passa de 50%.
   - `POST /disparos/campanhas/:id/estado` bloqueia ativação quando a saúde de instâncias está ruim (>50% desconectadas), retornando `409`.
   - Novo endpoint `POST /disparos/campanhas/:id/instancias` para adicionar instâncias ao `configSnapshot` da campanha (merge sem duplicar).
   - `GET /disparos/campanhas` agora retorna `instanceHealth` para a UI tomar decisão de botões e avisos.

2. Frontend (`index.html`):
   - Na lista de campanhas:
     - mostra aviso de pausa de segurança quando a campanha está acima do limite de desconexão;
     - exibe botão `+ Instâncias` nesse cenário;
     - desativa `Ativar campanha` enquanto a regra de segurança estiver violada.
   - Adicionada função `addInstancesToCampaign(campaignId)` para enviar instâncias da Seção 1 para a campanha.
   - Evento de clique para `.btn-campaign-add-instances` integrado ao fluxo da lista.

3. Build e ambientes:
   - `npm run build` executado.
   - Ambientes reiniciados:
     - `http://localhost:3000` (`start:prod`)
     - `http://localhost:3010` (`dev:isolado`)

## Arquivos alterados

- `src/index.ts`
- `index.html`
- `dist/index.js` (build)
- `dist/index.html` (build)

## Validação sugerida

- Deixar campanha ativa com poucas instâncias conectadas e forçar cenário >50% desconectadas.
- Confirmar que:
  - status vai para pausa;
  - botão `+ Instâncias` aparece;
  - botão `Ativar campanha` fica bloqueado.
- Adicionar instâncias via `+ Instâncias` (usando seleção da Seção 1), depois tentar ativar novamente.

## Segurança

- Sem exposição de segredos.
- Regra anti-bloqueio aplicada no backend e refletida na UI.

## Palavras-chave

`runCampaignDispatchTick`, `instanceHealth`, `+ Instâncias`, pausa-automatica-campanha, bloqueio-ativacao
