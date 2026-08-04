# Arquitetura

## Visão geral

Aplicação Node/TypeScript com Express, build para `dist/`, deploy via Docker/EasyPanel. Suporta dois modos de WhatsApp (API oficial e alternativa) e ambientes locais isolados (V02/V03).

Em produção, o container serve o conteúdo de `dist/` (incluindo `dist/index.html`). Alterações só em `index.html` da raiz ou em `src/` **não** entram na imagem até `npm run build` e commit do `dist/`.

## Fluxos principais

### Cadastro / boas-vindas assinante

1. Cadastro (landing ou Admin) persiste assinante em `waba-subscribers.json`.
2. Dispara e-mail + WhatsApp de boas-vindas (Evolution).
3. Reenvio pelo Admin não exige senha; mensagem usa fallback de senha do cadastro.

## Organização dos módulos

- Código de domínio e rotas em `src/`
- UI fonte em `index.html` → copiada para `dist/index.html` no build
- Scripts de operação e infra em `scripts/`
- Documentação operacional em `doc/`

## Padrões arquiteturais

- Persistência local JSON em `/app/data` (produção com volume).
- Assinantes: `WabaSubscriberRepository` (`waba-subscribers.json`).
