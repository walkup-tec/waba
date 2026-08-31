# LOG — Campanhas: ver relatório com saldo zerado

**Data:** 2026-08-17  
**Pedido:** assinante com créditos zerados deve continuar vendo relatórios das campanhas já geradas (API Oficial e Alternativa); o alerta de créditos só aparece ao tentar criar uma nova campanha.

## Contexto
- Caso real: `gusttavogaldino@gmail.com` disparou campanha API Oficial, saldo foi a zero e a tela de campanhas ficava bloqueada ao tentar ver o relatório.
- Comportamento antigo: `body.disparos-saldo-zero` cobria `.disparos-config-panel` com overlay (`pointer-events: none` + `::after`), o wizard “Nova campanha” ocupava a maior parte da tela e dava a impressão de que a aba inteira exigia créditos para ser vista.

## Causa
- `syncDisparosCreditsEmptyNudge()` usava o saldo **total** e aplicava overlay no painel de criação, sem distinguir visualizar campanhas existentes vs. gerar nova.
- A lista `#disparos-list` e o botão “Ver Relatório” não tinham checagem de créditos no backend; o bloqueio era só de UI e atrapalhava a leitura da tela.

## Solução
- Removido o overlay que bloqueava o painel inteiro.
- Lista de campanhas e relatórios permanecem clicáveis com saldo 0.
- Formulários de criação (wizard Oficial e `#disparos-config-legacy` Alternativa) ficam ocultos quando o saldo **da API da aba atual** é 0.
- Card compacto `#disparos-create-credits-lock` explica que relatórios continuam disponíveis e pede créditos só para nova campanha.
- Guarda extra em `submitDisCampaignWizard` e `createCampaignFromMappedSpreadsheet`.
- Master / créditos ilimitados seguem o fluxo normal.
- Marker: `DEPLOY-2026-08-17-campanhas-relatorio-saldo-zero`

## Arquivos
- `index.html` (CSS, markup, JS)
- `dist/index.html`
- `src/deploy-marker.ts` / `dist/deploy-marker.js`

## Como validar
1. Assinante com saldo 0 na API Oficial e campanha já gerada: abrir **API Oficial** → lista visível → **Ver Relatório** abre o modal.
2. Na mesma tela, o wizard de nova campanha não aparece; aparece o aviso para adicionar créditos.
3. Clicar **Adicionar créditos** leva à aba de contratação.
4. Se o mesmo usuário tiver saldo na Alternativa, a aba **API Alternativa** segue o fluxo normal de criação.
5. Assinante com saldo > 0: wizard/formulário de criação iguais ao de sempre.
6. Após redeploy: `GET /health` com marker `DEPLOY-2026-08-17-campanhas-relatorio-saldo-zero`.

## Palavras-chave
campanhas, relatório, saldo zero, créditos, API Oficial, API Alternativa, disparos-saldo-zero, nova campanha
