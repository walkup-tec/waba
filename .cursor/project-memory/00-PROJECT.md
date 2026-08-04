# Projeto

## Objetivo

Sistema de mensageria WhatsApp (API oficial e API alternativa) para integrações e disparos automáticos — projeto Waba / Drax.

## Stack

- Node.js 18+ / TypeScript
- Express
- Supabase (cliente JS)
- Docker / EasyPanel (produção)
- Traefik no VPS compartilhado (`srv1261237`)

## Ambientes oficiais

Somente estes três:

| Ambiente | Onde | Branch / uso |
|----------|------|----------------|
| V02 | localhost | desenvolvimento local |
| V03 | localhost | desenvolvimento local |
| Produção | publicado (`https://waba.draxsistemas.com.br/`) | branch `master` |

Qualquer outro ambiente **publicado** além de Produção não deve existir.

## Estrutura geral

| Pasta / arquivo | Papel |
|-----------------|--------|
| `src/` | Código da aplicação |
| `index.html` | UI fonte |
| `dist/` | Artefato servido em produção (Docker copia só isto) |
| `scripts/` / `scripts/infra/` | Scripts operacionais e de infra VPS |
| `doc/` | Documentação operacional |
| `public-pages/` | Páginas públicas |
| `shortener-waba/` | Encurtador |
| `.cursor/knowledge/` | Knowledge Base técnica reutilizável |
| `.cursor/project-memory/` | Memória específica deste projeto |

## Principais módulos

| Módulo | Responsabilidade |
|--------|------------------|
| App Express (`src/`) | API, UI e processamento de disparos |
| Admin Assinantes | Cadastro, lista, reenvio de boas-vindas, purge |
| Infra VPS (`scripts/infra/`) | Monitor, heal Traefik/Docker, CPU |
| Ambientes V02/V03 | Isolamento local (não publicar) |

## Escopo

**Dentro:** mensageria WhatsApp (oficial e alternativa), disparos, integrações, infra do app Waba no VPS.

**Fora:** projetos irmãos (ex.: Soma CRM) — compartilham VPS/Traefik, mas não são escopo deste repositório.
