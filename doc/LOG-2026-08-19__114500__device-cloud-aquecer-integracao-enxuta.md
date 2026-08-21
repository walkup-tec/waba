# Device Cloud — integração enxuta via Aquecer (sem CONFIRMAR)

## Contexto

Pedido: no fluxo Device Cloud, integrar número virtual no Evolution/aquecedor **sem** a etapa CONFIRMAR (`validacao-inbound`) usada no wizard normal de registro de instâncias.

## Solução

1. Botão **Aquecer** na janela do device (já existia visualmente em `dist/`; sincronizado em `index.html`).
2. Ao clicar:
   - Lê nome do device (título da janela) → `normalizeInstanceRegisterName` como nome EVO.
   - Lê telefone do campo DDD+número → envia com DDI 55 para `POST /instancias/registrar-qrcode`.
   - Exibe **código de vinculação** (pairing) e/ou QR na barra `device-cloud-warm-panel`.
   - Faz poll em `GET /instancias/:name/status-conexao` até `open`.
   - **Não** chama `startRegisterInboundValidation` / CONFIRMAR.
3. Após conectar:
   - `POST /instancias/:name/alias` com nome amigável do device.
   - `POST /instancias/uso-config` com `useAquecedor: true`, `useDisparador: false`.
   - `loadInstancesForInstanciasTab({ fullRefresh: true })`.

## Arquivos alterados

- `index.html` — UI warm panel, CSS, handlers JS (`warmDeviceCloudInstance`, polling enxuto).
- `dist/index.html` — gerado via `npm run build`.

## Como validar

1. Deploy em produção (push `master` → Actions Deploy FTP).
2. Aba **Dispositivos** → abrir device com WhatsApp configurado.
3. Preencher número → **Aquecer**.
4. No device: Aparelhos conectados → digitar código exibido.
5. Confirmar instância em **Instâncias** (nome do device, foto/número EVO) e uso aquecedor ativo — **sem** passo CONFIRMAR.

## Segurança

- Sem exposição de tokens EVO no frontend; usa APIs autenticadas existentes.
- Anti-spam: um fluxo por clique; polling passivo (sem `sendText` extra).

## Palavras-chave

device-cloud, aquecer, pairing-code, registrar-qrcode, integracao-enxuta, sem-confirmar, evolution-linked-devices
