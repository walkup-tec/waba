Waba - Drax # Sistema de mensageria para whatsapp API Oficial e API Alternativa
==============

Projeto para integrações e disparos automáticos utilizando API oficial e Sem API OFicial (dois modos para atender a necessidades diferentes).

## Requisitos

- Node.js 18 ou superior
- npm (ou outro gerenciador de pacotes compatível)

## Ambientes (produção vs V01 vs V02)

| Ambiente | URL local | Comando |
|----------|-----------|---------|
| Produção | https://waba.draxsistemas.com.br/ | deploy VPS `master` |
| **V01** | http://localhost:3011/version-01/ | `npm run dev:v01` (UI completa) |
| **V02** | http://localhost:3012/version-02/ | `npm run dev:v02` (UI igual produção) |

Guia completo: **[doc/AMBIENTES-V01-V02.md](doc/AMBIENTES-V01-V02.md)**

Primeira vez: `npm run init:env` → editar `.env.v01` e `.env.v02`.

## Scripts principais

- `npm run dev`: executa o projeto em modo desenvolvimento (ts-node)
- `npm run dev:v01` / `npm run dev:v02`: ambientes isolados (ver doc acima)
- `npm run build`: compila o TypeScript para JavaScript em `dist/`
- `npm start`: executa a versão compilada em produção

## Como iniciar

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Ambiente de desenvolvimento:
   ```bash
   npm run dev
   ```
3. Build de produção:
   ```bash
   npm run build
   npm start
   ```

## AdsPower (perfis WABA)

A Local API do AdsPower (`http://local.adspower.net:50325`) existe só no PC do operador. A DRAX na nuvem **não** alcança esse localhost.

1. No EasyPanel, defina `ADSPOWER_INGEST_TOKEN` (mesmo valor no PC).
2. No computador com AdsPower aberto:
   ```bash
   ADSPOWER_API_BASE=http://local.adspower.net:50325 \
   ADSPOWER_API_TOKEN=seu_token_local \
   DRAX_BASE=https://waba.draxsistemas.com.br \
   ADSPOWER_INGEST_TOKEN=mesmo_token_do_easypanel \
   node scripts/adspower-sync-to-drax.mjs
   ```
3. No painel: **FARM BM → Perfis AdsPower**. Um perfil = uma conta WABA oficial já conectada no Laboratório.
4. Aprovar templates e disparar segue em **Templates** e **Disparo Cloud** (Cloud API). A Meta registra esses envios oficiais. O AdsPower isola o navegador no PC; não esconde a API oficial.

Se a DRAX e o AdsPower rodarem no mesmo PC, `POST /integrations/adspower/sync` puxa a lista direto da Local API.

