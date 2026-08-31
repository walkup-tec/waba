# LOG — Fix build Docker shortener ausente

**Data:** 2026-06-19

## Erro Easypanel

```
src/index.ts(35,8): error TS2307: Cannot find module './shortener/waba-shortener.service'
```

Commit `7b0cdf2` referenciava shortener em `index.ts` mas `src/shortener/` não estava no Git.

## Correção

- Adicionados `src/shortener/waba-shortener.service.ts` e `waba-shortener.repository.ts`
- Marker: `DEPLOY-2026-06-19-fix-shortener-src-build`

## Validação local

```bash
npm run build
```

Exit 0.
