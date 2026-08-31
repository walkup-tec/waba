# LOG — V01 tela preta (JS syntax error)

**Data:** 2026-06-19  
**Contexto:** `localhost:3011/version-01/` carregava tela preta após restore do Disparador EVO.

## Causa raiz

Erro de sintaxe em `index.html` na função `loadDisparosEvoCampaigns`:

```js
// Errado (caractere · no lugar de ??)
Number(runtimeRaw?.fillPercent · (isRunning ? 90 : ...))

// Correto
Number(runtimeRaw?.fillPercent ?? (isRunning ? 90 : ...))
```

Corrompido na restauração automática a partir de `agent-tools/old-loadDisparosTemplates.js.txt`.  
Validação: `new Function(script)` → `missing ) after argument list`.

## Alterações

- `index.html` linha ~25400: `??` restaurado
- `dist/index.html`: mesmo fix (build/prod)

## Validação

- `node -e "new Function(...)"` → **syntax ok**
- Servidor dev V01 lê `index.html` da raiz a cada request (`RUNTIME_MODE=development`)

## Próximo passo usuário

1. **Ctrl+F5** em http://localhost:3011/version-01/
2. Se ainda preto: reiniciar `npm run dev:v01`

## Pendências

- EVO local `127.0.0.1:8081` offline (ECONNREFUSED) — não impede UI, só instâncias/QR
