# LOG: Meta Pixel + evento Contact — PaginaVendas-LV (FTP)

## Contexto

Implementar Meta Pixel (`1244070901219529`) na landing estática em `E:\PaginaVendas-LV` e disparar o evento padrão **Contact** ao clicar em links de conversão (WhatsApp: `wa.me` / `api.whatsapp.com`), sem recompilar o bundle React.

## Solução

1. **`<head>`**: substituído o placeholder do pixel por `init` + `track` `PageView` e bloco `<noscript>` com imagem de rastreamento.
2. **`</body>`**: script de delegação de evento em fase de captura em `document`, que detecta clique em `a[href]` cujo `href` contém `wa.me` ou `api.whatsapp.com` e chama `fbq("track", "Contact")` antes da navegação.

## Arquivos alterados

- `E:\PaginaVendas-LV\index.html`

## Como validar

- Abrir o site local ou após upload; no **Meta Pixel Helper** (Chrome) verificar carregamento do pixel e evento **PageView**.
- Clicar no CTA do WhatsApp e verificar evento **Contact** (ou em Test Events no Gerenciador de Anúncios).
- Conferir que o link do bundle continua apontando para `wa.me/...` (listener cobre todos os `<a>` com esse padrão).

## Segurança

- ID do pixel é público por desenho; não há segredos no HTML.

## Palavras-chave

`meta-pixel`, `fbq`, `Contact`, `PaginaVendas-LV`, `wa.me`, `lvpromotora`
