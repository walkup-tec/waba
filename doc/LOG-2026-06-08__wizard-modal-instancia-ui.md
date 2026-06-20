# LOG — Wizard modal conectar instância (UI passo a passo)

**Data:** 2026-06-08  
**Pedido:** Modal intuitivo, autoinstrução, cabendo na tela sem scroll.

## Implementado (`index.html`)

- Modal **wizard 4 passos** com stepper: Dados → QR Code → Validar → Pronto
- Uma etapa visível por vez (`max-height: 92vh`, QR compacto ~180px)
- Passo 3: card de instruções numeradas + checks visuais (recepção / resposta automática)
- Botões contextuais por passo (Gerar QR / Atualizar QR / Pular / Concluir)
- Avanço automático: QR gerado → passo 2; conectado → passo 3; validado → passo 4

## Marker

- `DEPLOY-2026-06-08-wizard-instancia-v1`

## Teste

- `npm run build` + `npm run dev:v02`
- Ctrl+F5 em `http://localhost:3012/version-02/`
