# Device Cloud — lingueta «Adicionar ao Aquecedor»

## Contexto

Substituir o botão **Aquecer** na barra do device por uma **lingueta** (tab) que surge após cadastrar o número no WhatsApp. A integração EVO/aquecedor só inicia ao clicar na lingueta.

## Fluxo

1. Usuário digita DDD+número e clica **Digitar** → WhatsApp avança no device.
2. Lingueta **«Adicionar ao Aquecedor»** aparece acima da área do telefone (borda ciano).
3. Clique na lingueta → integração Evolution (sem etapa CONFIRMAR).
4. Durante integração: lingueta **«Aguarde um instante...»** (não clicável).
5. Após instância listada em **Instâncias**: lingueta **«Integração Finalizada»** + menu **Instâncias** pulsa.

## Implementação

- HTML: `.device-cloud-warm-tab` + `.device-cloud-phone-shell` no template do device.
- CSS: gradiente laranja/vermelho na lingueta; shell com borda ciano quando visível; `@keyframes instancias-menu-pulse`.
- JS: `setDeviceCloudWarmTab`, `pulseInstanciasMenuForNewIntegration`, `clearInstanciasMenuNewHighlight` (limpa ao abrir aba Instâncias).
- Removido `.device-cloud-warm-btn` da barra superior.

## Arquivos

- `index.html`

## Validar

1. Device Cloud → cadastrar número → lingueta aparece.
2. Clicar lingueta → «Aguarde um instante...» → após conectar → «Integração Finalizada».
3. Menu Instâncias pulsa até o usuário abrir a aba.

## Keywords

device-cloud, lingueta, aquecedor, instancias-menu-pulse, integracao-enxuta
