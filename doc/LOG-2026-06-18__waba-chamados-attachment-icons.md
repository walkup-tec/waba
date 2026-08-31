# LOG — Chamados master: ícones de anexo

**Data:** 2026-06-18

## Pedido
Na tela de chamados (master), exibir ícones para imagem, vídeo e áudio; ao clicar, abrir o arquivo.

## Implementação (`D:\Waba\index.html`)
- `resolveAdminChamadosAttachmentKind()` — fallback por `mimeType` e extensão do arquivo.
- `buildAdminChamadosAttachmentOpenLink()` — ícone SVG + link `target="_blank"`.
- Lista (coluna Anexos) e modal Detalhes usam os mesmos ícones.
- Cores: imagem azul, vídeo rosa, áudio verde.
- Nome do arquivo também é link clicável no modal.

## Marker
`DEPLOY-2026-06-18-waba-chamados-attachment-icons`

## Validação
Hard refresh em `http://localhost:3012/version-02/` → Chamados → Detalhes.
