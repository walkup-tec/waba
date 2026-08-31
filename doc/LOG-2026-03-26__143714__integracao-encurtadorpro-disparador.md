## Contexto do pedido

Integrar o projeto Waba ao EncurtadorPro no fluxo do Disparador para encurtamento com rastreio de abertura/cliques, conforme documentação oficial.

## Acoes executadas

1. Analisei o fluxo atual de encurtador no backend (`src/index.ts`) e no frontend (`index.html`).
2. Adicionei o provedor `encurtadorpro` ao contrato de configuração e normalização de providers.
3. Implementei chamada HTTP para `POST https://app.encurtadorpro.com.br/api/url/add` com:
   - `Authorization: Bearer <API_KEY>`
   - timeout (10s)
   - retry com backoff + jitter para falhas transitórias
   - validação de resposta (`error=0` e `shorturl`/`short` válido)
4. Mantive fallback automático para `is.gd` e `tinyurl`.
5. Atualizei metadados de providers retornados em `GET /disparos/config` e label de exibição da UI.
6. Rodei `npm run build` e validação de lints dos arquivos alterados.

## Arquivos alterados

- `src/index.ts`
- `index.html`
- `doc/LOG-2026-03-26__143714__integracao-encurtadorpro-disparador.md`
- `doc/memoria.md`

## Como validar

1. Configurar variáveis de ambiente no Waba:
   - `ENCURTADORPRO_API_KEY` (obrigatória para o provider)
   - opcional: `ENCURTADORPRO_DOMAIN`
   - opcional: `ENCURTADORPRO_CUSTOM_ALIAS`
   - opcional: `SHORTENER_PROVIDER=encurtadorpro` para forçar provider
2. Reiniciar servidor.
3. Testar endpoint:
   - `POST /disparos/shorten` com `{ "longUrl": "https://exemplo.com" }`
4. Confirmar que a resposta retorna `shortUrl` e `provider: "encurtadorpro"`.
5. Verificar no painel EncurtadorPro se o link aparece com métricas de clique/abertura.

## Observacoes de seguranca

- Chave de API não foi escrita em código fonte.
- Autenticação permanece via variável de ambiente.
- Nenhum header de autorização é logado.

## Palavras-chave

- encurtadorpro
- disparos-shorten
- shortlink-rastreio
- retry-timeout
