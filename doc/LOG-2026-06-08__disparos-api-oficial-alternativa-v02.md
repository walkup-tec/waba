# LOG — Menu Disparos: API Oficial vs Alternativa (V02)

**Data:** 2026-06-08  
**Pedido:** Tela no menu Disparos com duas opções conforme mockup.

## Implementado

- Substituiu "Lançamento em breve" em `#tab-disparos-lancamento`
- Dois cards: **API Oficial** e **API Alternativa**
- Prévia de modelo (imagem + texto + botão ou link)
- Faixas de investimento e crédito mínimo R$ 300
- Nota amarela central explicando diferença botão vs link
- Botão **Contratar** grava escolha em `localStorage` (`waba.disparos.api-choice`) + toast

## Arquivos

- `index.html` (CSS + HTML + `initDisparosApiChoice()`)
- `dist/index.html` (build)

## Validar

1. `npm run dev:v02`
2. http://localhost:3012/version-02/
3. Menu **DISPAROS** → aba Disparos

## Pendências

- Fluxo real de contratação após Contratar
- Deploy branch `v02` / produção quando aprovado
