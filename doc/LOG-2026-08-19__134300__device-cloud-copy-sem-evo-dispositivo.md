# Device Cloud — copy: sem EVO/Evolution; device → dispositivo

## Contexto

Pedido: remover menções a **EVO** e **Evolution** dos textos visíveis do fluxo Dispositivos (lingueta + integração) e substituir **device** por **dispositivo** nas mensagens ao usuário.

## Alterações em `index.html`

- Lingueta/painel: status, hints, toasts e títulos sem Evolution/EVO.
- Mensagens de erro compartilhadas (`resolveRegistrarQrcodeErrorMessage`, `registrar-qrcode`) sem EVO/Evolution.
- `Device Cloud` / `device` → **Dispositivos** / **dispositivo** nas strings de UI.
- Identificadores de código (`device-cloud-*`, rotas API) inalterados.

## Validar

1. Dispositivos → lingueta → textos sem Evolution/EVO.
2. Toast: «Dispositivo integrado».
3. Hint: «deste dispositivo».

## Keywords

device-cloud, copy, dispositivo, sem-evo, lingueta-aquecedor
