# Device Cloud — navegação assertiva Aparelhos conectados

## Sintoma

Após «Adicionar ao Aquecedor», o device abria o **navegador** (busca com teclado) e o pairingCode era digitado lá (ex.: letra «P»), em vez de:

**Menu ⋮ → Aparelhos conectados → Conectar aparelho → Vincular com número de telefone.**

## Causa raiz (confiança: Alta)

1. Navegação cega por **Perfil → lista de Configurações** (coordenadas frágeis), fora do fluxo oficial da Meta.
2. Toques extras (aba Conversas y=1235) desviavam o foco.
3. Digitação do `pairingCode` **sem validar** se a tela era WhatsApp → texto ia para o Chrome.

## Solução

1. Caminho oficial (FAQ Meta Android): More (⋮) → Linked devices → Link a device → phone number.
   - URL: https://faq.whatsapp.com/1317564962315842/?cms_platform=android
2. `ensureDeviceCloudWhatsAppForeground`: HOME + launch WA + detecção browser → BACK/relaunch.
3. `classifyDeviceCloudScreen`: amostragem de cor (header verde WA vs teclado claro do browser).
4. **Gate**: não digita código se a tela for `browser`.

## Arquivos

- `index.html` — nav + classificação + gate
- `src/deploy-marker.ts` — `DEPLOY-2026-08-20-device-cloud-menu-aparelhos-assertivo`

## Validação

- Técnica: código no repo.
- Funcional: Redeploy `waba_disparador` + teste real no device (deve abrir tela «Insira o código», não Chrome).

## Palavras-chave

aparelhos-conectados, overflow-menu, pairingCode, browser-gate, classifyDeviceCloudScreen, whatsapp-faq
