Disparador N8
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

