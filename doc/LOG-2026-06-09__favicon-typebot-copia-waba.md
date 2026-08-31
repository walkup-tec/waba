# LOG — Favicon Typebot → WABA

**Data:** 2026-06-09

## Origem

`D:\typebot-Saas\apps\admin\public\`
- `favicon.ico`
- `favcon.png`

## Destino WABA

| Arquivo | Caminho |
|---------|---------|
| ICO raiz | `favicon.ico` → `dist/favicon.ico` (build) |
| ICO media | `media/favicon.ico` |
| PNG | `media/favcon.png`, `media/favicon.png` |

## index.html

Mesmo padrão do painel Typebot/admin:
- `/favicon.ico`
- `/media/favcon.png`
- shortcut + apple-touch-icon

## Validar

`npm run dev:v02` → aba do navegador / hard refresh (favicon cacheia forte).
