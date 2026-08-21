# Device Cloud — falso «navegador» na tela Insira o código

## Sintoma

UI: `Tela errada (navegador)…` com Cancelar / Tentar de novo.  
Screenshot do device: já em **Insira o código** (caixas + teclado QWERTY).

## Causa raiz (confiança: Alta)

`classifyDeviceCloudScreen` usava:

- `waGreenTop < 0.08 && lightKeyboard > 0.5` → `"browser"`

A tela WA Business «Insira o código» (tema claro) tem barra **branca** (sem teal) e teclado **claro** → falso positivo.  
`typeDeviceCloudPairingCodeOnDevice` abortava antes de digitar.

## Correção

1. Detectar caixas do código (tinta preta na faixa y≈33–42%) → `"whatsapp"`.
2. `"browser"` só com barra Chrome + teclado claro **e** sem caixas de código.
3. Digitação do pairingCode **não aborta** mais por `classify === "browser"`.

## Arquivos

- `index.html` (`classifyDeviceCloudScreen`, `typeDeviceCloudPairingCodeOnDevice`)
- `src/deploy-marker.ts` → `DEPLOY-2026-08-21-dc-fix-false-browser-pairing-screen`

## Validação

Hard refresh V02 → Adicionar ao Aquecedor → ao chegar em Insira o código, deve digitar os 8 chars sem erro de navegador.
