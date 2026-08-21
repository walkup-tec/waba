# Device Cloud — estilo botão Aquecer (Aquecedor)

## Contexto

Ajustar o botão **Aquecer** na janela Device Cloud para o mesmo visual do botão **Aquecedor** de referência: fundo escuro, borda cobre, texto branco, ícone chama laranja.

## Alterações

- Removida classe `btn-qrcode` (verde) do botão.
- CSS dedicado `.device-cloud-warm-btn.instance-action-btn.enabled`:
  - `background: #231f20`
  - `border: 1px solid #d68d54`
  - `border-radius: 10px`
  - texto `#ffffff`, ícone `#ffa500`
  - hover levemente mais claro

## Arquivos

- `index.html`

## Validação

Recarregar aba Dispositivos (Ctrl+F5) e comparar botão Aquecer com referência Aquecedor.

## Palavras-chave

device-cloud, aquecer, estilo, aquecedor, botão cobre
