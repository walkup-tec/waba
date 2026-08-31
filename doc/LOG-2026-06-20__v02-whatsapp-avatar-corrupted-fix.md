# LOG — V02 avatar WhatsApp corrompido

**Data:** 2026-06-20  
**Contexto:** Lista de instâncias exibia ícone de imagem quebrada na coluna de avatar (Número).

## Sintoma
- Círculo gradiente com ícone de foto quebrada em vez de avatar ou placeholder ◎.
- Proxy `/instancias/avatar` respondia **400/502 JSON** — browser trata como imagem inválida.

## Causa raiz
1. Servidor V02 rodando **código antigo** (antes do fix): avatar vazio/host inválido → JSON 400.
2. `dist/index.html` desatualizado (sem sanitização de URL).
3. Cache localStorage podia regravar URLs inválidas após sanitize em memória.

## Correções
- **Backend** (`src/index.ts`): `sendInstanceAvatarPlaceholder()` — SVG gradiente ◎ com HTTP 200 em qualquer falha; hosts ampliados; `Referer: web.whatsapp.com`.
- **Frontend** (`index.html`): `sanitizeInstanceProfilePicUrl`, fallback inline `◎`, `bindInstanceAvatarFallback`, escape HTML no `src`.
- **Cache:** `persistInstancesLocalCache(sanitized)` em vez de payload bruto.
- **Build + restart V02** — validado `GET /instancias/avatar?url=` → `200 image/svg+xml`.

## Validação
```text
empty: 200 image/svg+xml; charset=utf-8
badhost: 200 image/svg+xml; charset=utf-8
```

## Pendências
- Usuário: **Ctrl+F5** na aba Instâncias (limpa JS/HTML antigo).
- Opcional: limpar `localStorage` chave `waba.instances.cache.v1.{email}` se ainda ver URLs velhas.
- Fotos reais voltam após **Atualizar** com EVO online (`?refresh=1`).

## Arquivos
- `src/index.ts`, `index.html`, `dist/index.html`, `dist/index.js`
