# LOG — Menu Conectar WhatsApp na seção Laboratório

## Contexto do pedido

Mover o submenu **Conectar WhatsApp** para baixo da seção **Laboratório**. Novos menus da função Meta Tech Provider devem nascer nessa seção. A largura do menu lateral deve acompanhar a largura dos botões, sem estourar o texto.

## Ações executadas

- Recriação do grupo **Laboratório** (`lab-api-oficial`) no menu desktop e mobile, com o item **Conectar WhatsApp**.
- Registry: `whatsapp-oficial` em `section: "lab-api-oficial"`; constante `WABA_TECH_PROVIDER_MENU_IDS` para itens futuros.
- Sidebar expandida: `width: max-content` (mín. 220px) e padding do shell via `--waba-sidebar-stack-width`.
- Cópia de `index.html` para `dist/index.html` (servidor V02 local lê `dist/`).

## Arquivos criados/alterados

- `index.html`
- `dist/index.html`
- `src/menus/waba-menu-registry.ts`
- `src/menus/waba-menu-permissions.service.ts`

## Como validar

1. Abrir a UI de produção (`waba-ui-production`).
2. Expandir o menu lateral: o grupo **Laboratório** aparece depois de **Disparos**.
3. O botão **Conectar WhatsApp** não deve cortar o texto.
4. Clicar abre a aba `tab-whatsapp-oficial`.

## Observações de segurança

Nenhuma chave ou token foi alterada.

## Palavras-chave (evitar duplicação)

laboratorio, lab-api-oficial, conectar-whatsapp, meta-tech-provider, sidebar-width, waba-sidebar-stack-width
