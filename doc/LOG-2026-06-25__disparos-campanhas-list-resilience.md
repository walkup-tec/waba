# LOG — Lista de campanhas geradas (resiliência intermitente)

**Data:** 2026-06-25  
**Marker:** `DEPLOY-2026-06-25-disparos-campanhas-list-resilience`

## Contexto

Usuário reportou falha **intermitente** ao carregar a lista de campanhas geradas (API Oficial / painel Campanhas). Às vezes aparecia mensagem genérica de falha e a lista sumia.

## Causas prováveis

1. Timeout (10s) ou rede instável no poll a cada 5–30s
2. Falha 503 durante deploy/manutenção
3. Requisições concorrentes (poll + refresh + pós-submit) — a mais lenta podia sobrescrever a UI com erro
4. Escrita síncrona do JSON de intakes podia gerar leitura inconsistente durante POST de nova campanha

## Solução

### Frontend (`index.html`)

- `fetchDisparosCampaignListWithRetry` — até 3 tentativas com backoff em 5xx/rede
- `resolveWabaPublicPath` em todas as URLs da lista
- Timeout 15s (intake) / 20s (EVO)
- `disparosCampaignsLoadSeq` — ignora respostas obsoletas
- Em falha: **mantém cache** e exibe faixa laranja “Exibindo a última lista carregada” (padrão Aquecedor envios)
- Mensagens específicas: timeout, rede, 401, 503 manutenção
- API Oficial (`isDisparosCampanhasIntakeOnlyUi`): não exibe "Erro ao carregar" no header quando `/disparos/config` falha; config carrega em segundo plano com retry

### Backend

- `GET /disparos/campanhas/intake` com try/catch e 500 JSON
- `waba-campaign-intake.repository.ts` — escrita atômica (tmp + rename)

## Arquivos alterados

- `index.html`
- `src/disparos/waba-campaign-intake.routes.ts`
- `src/disparos/waba-campaign-intake.repository.ts`
- `src/deploy-marker.ts`

## Validar

1. Abrir Disparos → Campanhas; lista carrega
2. Durante rede lenta ou redeploy, lista anterior permanece visível com aviso
3. Botão **Atualizar** recarrega sem apagar cache em falha transitória
4. Após gerar campanha, nova entrada aparece na lista (ou após Atualizar)

## Palavras-chave

`disparos-list`, `campanhas geradas`, `loadDisparosTemplates`, `intake list`, `retry`, `cache`, `disparosCampaignsLoadSeq`
