# LOG — Encurtador próprio WABA (substitui EncurtadorPro no backend)

**Data:** 2026-06-19  
**Pedido:** Gerar URL curta própria mantendo fluxo frontend (Testar encurtador / POST `/disparos/shorten`).

## Solução

### Backend (sem mudar contrato da API)
- Novo provider **`waba`** (default via `SHORTENER_PROVIDER=waba`)
- `POST /disparos/shorten` — mesmo payload/resposta `{ ok, shortUrl, provider }`
- `GET /s/:slug` — redirect 302 + contagem de cliques em `data/{env}/shortener-links.json`
- Slug aleatório ou derivado do `_n8n_*_nonce` (mesma lógica anti-reuso)
- **Fallback:** se `ENCURTADORPRO_API_KEY` existir e WABA falhar, tenta EncurtadorPro

### Arquivos
- `src/shortener/waba-shortener.repository.ts`
- `src/shortener/waba-shortener.service.ts`
- `src/index.ts` — provider, redirect, relatório de cliques

### Env (V02 local)
```
SHORTENER_PROVIDER=waba
WABA_SHORT_PUBLIC_BASE=http://localhost:3012
```

Produção: `WABA_SHORT_PUBLIC_BASE=https://wabaurl.waba.info` (ou domínio do shortener).

### Frontend
- **Inalterado** no fluxo; só label do provider readonly: «WABA (encurtador próprio)».

## Validar
1. Ctrl+F5 V02 → Disparador → Testar encurtador
2. Deve retornar URL `http://localhost:3012/s/xxxxxxx`
3. Abrir link no navegador → redirect para wa.me
