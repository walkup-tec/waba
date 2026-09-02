# LOG — Teste 0/3 rodou no dist antigo

## Contexto

Usuário Redeployou, testou e viu de novo «0 de 3 cadastrados» com a frase genérica da Graph 400. Screenshots sem «Botão na Meta: …/s/…».

## Causa (alta confiança)

EasyPanel copia **`dist/`** do Git (`Dockerfile`: `COPY dist ./dist`, sem `tsc` na imagem).

- GitHub `src/` já tinha o encurtador (`7d4bfda`).
- `dist/` commitado parou em `1f41df7` / marker `DEPLOY-2026-09-01-201200-cabecalho-fixo-utilidade`.
- Produção `GET /health`: esse marker antigo.
- HTML público: overlay do modal, sem o texto do link curto.

O teste não exercitou o encurtador. Foi o mesmo payload antigo.

## Solução

`npm run build` + commit de `dist/` + push GitHub `master`.

Marker novo: `DEPLOY-2026-09-02-010000-dist-botao-encurtado`

## Como validar

Após Redeploy do **`waba_disparador`**:

```bash
curl -sS https://waba.draxsistemas.com.br/health
```

Esperado: `deployMarker` = `DEPLOY-2026-09-02-010000-dist-botao-encurtado`.

Campo do botão deve dizer que a Meta recebe o link curto. Se ainda recusar, o modal deve mostrar o detalhe da Graph e/ou `Botão na Meta: https://…/s/…`.

## Palavras-chave

dist, Dockerfile COPY dist, EasyPanel, deployMarker, 0 de 3, Graph 400
