# LOG — Device Cloud: cliques lentos e WhatsApp fecha

## Contexto

Pedido: muitos travamentos, clique sem efeito, WhatsApp abre e fecha, lentidão ao responder.

## Causa raiz (evidência em produção 2026-08-18)

1. **WhatsApp crash loop** — foco atual `Application Error: com.whatsapp.w4b`. Logcat:
   `UnsatisfiedLinkError: Kaleidoscope.init` (JNI nativo ARM64 no Redroid x86_64). Crashes repetidos 09:56–10:20. Cliques caem no diálogo de erro, não no app.
2. **Latência de UI** — cada toque aguardava screenshot (WABA Hostinger → API AWS Ohio) e a tela fazia poll a cada 1s, enfileirando `screencap` no ADB.
3. **Fallback Abrir WhatsApp** fazia dezenas de swipes/taps lentos quando a API falhava.

Confiança: **Alta** nos itens 1–2; crash nativo de ABI não some só com UI.

## Solução

- Toque não espera screenshot; fila de input; poll 1,6s; cache 400ms de screenshot no WABA.
- Abrir WhatsApp: fecha diálogo de crash, `am force-stop` + `am start`, fallback curto.
- Marker WABA: `DEPLOY-2026-08-18-device-cloud-input-snappy`.

## Validar

1. Redeploy `waba_disparador` e conferir `/health` marker.
2. Toques devem responder sem esperar a foto da tela.
3. WhatsApp ainda pode fechar se o JNI Kaleidoscope falhar — limitação do APK ARM64 no Redroid x86.

## Palavras-chave

device-cloud, lag, screenshot poll, Kaleidoscope, UnsatisfiedLinkError, virt-touch
