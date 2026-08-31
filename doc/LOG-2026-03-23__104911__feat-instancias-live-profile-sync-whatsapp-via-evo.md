# LOG - feat-instancias-live-profile-sync-whatsapp-via-evo

## Contexto do pedido

Foi solicitado parar de depender apenas do cache de `fetchInstances` da EVO e capturar nome/foto mais diretamente da sessao WhatsApp conectada.

## Acoes executadas

- Backend (`src/index.ts`):
  - Adicionado `EVO_LIVE_PROFILE_SYNC` (ativo por padrao).
  - Criado fluxo `fetchLiveWhatsappProfile(instanceName, numberLike)` com fallback de rotas:
    - `GET /profile/fetchProfile/{instance}`
    - `GET /instance/fetchProfile/{instance}`
    - `POST /chat/fetchProfilePictureUrl/{instance}` com `number` em formato numerico
    - `POST /chat/fetchProfilePictureUrl/{instance}` com `number` em formato JID (`@s.whatsapp.net`)
  - Parsing robusto para nome e foto (`pickProfileNameFromPayload`, `pickProfilePictureFromPayload`).
  - Endpoint `/instancias` agora enriquece instancias conectadas com dados ao vivo (quando disponivel).
  - `avatarVersion` passa a ser atualizado com timestamp do sync ao vivo para refletir recarga imediata.

- Operacional:
  - Build executado.
  - Servidor reiniciado para carregar nova logica.

## Validacao

- Teste em `5401` e `1279` apos restart:
  - `avatarVersion` passou a renovar em tempo real.
  - `profilePicUrl` de `5401` foi alterado para URL nova vinda do sync ao vivo.

## Arquivos alterados

- `src/index.ts`
- `dist/index.js` (build)

## Observacoes de seguranca

- Sem exposicao de segredos.
- Chamadas externas continuam via `apikey` no backend.
- Fallback silencioso evita indisponibilidade da tela caso rota especifica nao exista na versao da EVO.

## Palavras-chave

- live-profile-sync
- fetchProfilePictureUrl
- fetchProfile
- instancia-whatsapp-nome-foto
