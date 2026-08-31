# LOG — Fix encurtador + Salvar configurações (API Alternativa)

**Data:** 2026-07-13 ~14:50  
**Sintomas:** «Falha ao gerar URL: Falha ao testar encurtador.»; botão Salvar configurações da seção Encurtador parecia não gravar.

## Causas

1. **Encurtador:** ordem de provedores só tentava `waba` (+ `encurtadorpro` se key). `isgd`/`tinyurl` estavam no tipo mas **não implementados** — falha silenciosa → 502 genérico / mensagem vazia no front.
2. **Salvar por seção:** `allowPartialSave` fazia merge cego e podia **zerar** `selectedDisparadorInstances`, WhatsApp, URL e briefing quando o form da seção não tinha esses campos preenchidos.

## Correções

- Implementados fallbacks **is.gd** e **TinyURL** em `shortenUrlWithProvider`.
- Ordem: primary → waba → encurtadorpro (se key) → isgd → tinyurl.
- `/disparos/shorten` devolve detalhe dos provedores que falharam.
- Front: timeout 45s, erros HTTP/corpo legíveis, `resolveWabaPublicPath`.
- `/disparos/config` com `allowPartialSave`: preserva campos críticos se o payload vier vazio.
- Seção Encurtador: valida WhatsApp no save; feedback se falhar.

Marker: `DEPLOY-2026-07-13-fix-encurtador-salvar-secao`

## Validar após Redeploy

1. API Alternativa → Encurtador → informar WhatsApp → **Salvar configurações** → toast de sucesso + check na seção.
2. **Testar encurtador** → URL `https://…/s/…` ou is.gd/tinyurl.
3. Recarregar página e confirmar WhatsApp ainda preenchido.

## Keywords
`encurtador`, `disparos/shorten`, `isgd`, `tinyurl`, `allowPartialSave`, `Salvar configurações`
