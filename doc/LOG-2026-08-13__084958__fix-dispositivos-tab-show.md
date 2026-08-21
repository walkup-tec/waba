# LOG — fix aba Dispositivos vazia (setActiveTab)

## Contexto do pedido
Usuário abriu **Dispositivos** em produção (`mozart.pmo@gmail.com`) e viu só a faixa «Você está no ambiente» / tela vazia — sem painel Device Cloud.

## Sintoma observado
Menu **Dispositivos** fica ativo; área principal fica em branco.

## Hipótese / causa raiz
`setActiveTab` escondia as outras abas, mas **nunca** removia `tab-hidden` de `#tab-dispositivos` (painel criado sem wiring no switcher).

**Confiança:** Alta.

## Solução implementada
1. Em `index.html` (`setActiveTab`): obter `#tab-dispositivos` e alternar `tab-hidden` / `aria-hidden` quando `nextTab === "dispositivos"`.
2. Copiar para `dist/index.html`.
3. Marker: `DEPLOY-2026-08-13-device-cloud-tab-show`.

## Arquivos criados/alterados
- `index.html`
- `dist/index.html`
- `src/deploy-marker.ts`
- `dist/deploy-marker.js`
- `doc/LOG-2026-08-13__084958__fix-dispositivos-tab-show.md`
- `doc/memoria.md`

## Como validar
1. Redeploy `waba_disparador` e confirmar marker em `/health`.
2. Login mozart → Aquecedor → Dispositivos.
3. Deve aparecer painel **DRAX Device Cloud** com botões «Abrir Device Cloud» / «Gerar acesso SSO».
4. Abrir Device Cloud só funciona se `DEVICE_CLOUD_*` estiver configurado **e** o app Device Cloud estiver no ar na URL pública.

## Observações
- A tela WABA **não** é o dashboard de dispositivos: é um launcher + iframe/SSO.
- Device Cloud (repo `drax-device-cloud`) ainda precisa estar hospedado para o iframe carregar conteúdo.

## Palavras-chave
`dispositivos`, `setActiveTab`, `tab-hidden`, `device-cloud`, `tela vazia`
