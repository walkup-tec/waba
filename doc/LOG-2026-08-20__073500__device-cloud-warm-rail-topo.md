# Device Cloud — cluster de aquecimento no topo (warm-rail)

## Contexto

Feedback de UX: a lingueta crescia com subtexto e cobria o device; o botão «Inserir código» ficava abaixo do aparelho. O usuário pediu tudo no mesmo local (topo) e que o sistema abra sozinho **Aparelhos conectados → Vincular com número**.

## Solução (Frontend UX)

Layout em duas camadas no chrome, sem painel embaixo do device:

1. **Lingueta compacta (1 linha)** — só fase curta («Adicionar ao Aquecedor» / Aguarde…).
2. **Warm-rail** — faixa dentro do chrome (logo abaixo de EM-xxxx / Reiniciar / Excluir) com status + Cancelar + Inserir código.

Reserva da lingueta: `58px` → `34px` para não cobrir a tela Android.

## Fluxo

Após gerar `pairingCode`, o sistema chama automaticamente:

`Aparelhos conectados → Vincular com número` → digita o código → poll de conexão.

Se falhar, a rail mantém **Inserir código** para retry.

Copy de poll: evita «Código aceito» falso quando o WhatsApp ainda mostra erro no device.

## Arquivos

- `index.html` — CSS/HTML/JS (warm-rail + auto-nav)
- `src/deploy-marker.ts` — `DEPLOY-2026-08-20-device-cloud-warm-rail-topo`

## Validação

- Evidência técnica: markup/CSS/JS no `index.html`.
- Evidência funcional: depende de Redeploy Easypanel (`waba_disparador` serve `dist/`) + teste real no device.

## Layout / altura (adiado)

- Sem barra de rolagem colada ao device: `#device-cloud-stage { overflow: visible }`.
- A altura definitiva do espaço (stage ou footer) **só será definida depois** de finalizar o fluxo de aquecimento/pairing.

## Palavras-chave

device-cloud, warm-rail, lingueta, Aparelhos conectados, Vincular com número, pairingCode, layout topo, overflow visible, altura adiada
