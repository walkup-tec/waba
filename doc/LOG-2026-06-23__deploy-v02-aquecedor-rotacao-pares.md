# LOG — Deploy V02 + produção: aquecedor rotação de pares

## Pedido

Atualizar V02 e deixar commit/push pronto para deploy em produção.

## Conteúdo do commit

- `src/index.ts` — rotação dinâmica de pares A→B (`recentDirectedEdges`, penalidades de repetição, bônus idle).
- `src/deploy-marker.ts` — `DEPLOY-2026-06-23-aquecedor-rotacao-pares`
- `doc/LOG-2026-06-23__aquecedor-rotacao-pares-dinamica.md`
- `doc/memoria.md`

## Já em produção (commits anteriores nesta sessão)

- `2bf3269` — campanha min 4 + pausa 50%
- `e61ae81` — preparando promoção imediata
- `250a080` — preparando 6h sem fila

## Validação

```powershell
cd D:\Waba-master
npm run build
# V02: scripts/dev-v02.ps1 → http://localhost:3012/version-02/
```

## Deploy

Push `master` → GitHub Actions **Deploy FTP (bundle)**.
