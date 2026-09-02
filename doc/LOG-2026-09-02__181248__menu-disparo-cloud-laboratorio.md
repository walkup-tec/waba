# LOG — Menu Disparo Cloud na seção Laboratório

## Contexto do pedido

O disparador Cloud não deveria ficar no meio da aba Templates. O usuário pediu um menu **Disparo Cloud**, dentro da seção **Laboratório**, imediatamente acima de **Automação**.

## Ações executadas

1. Registro do menu `whatsapp-disparo-cloud` em `src/menus/waba-menu-registry.ts` e em `WABA_TECH_PROVIDER_MENU_IDS`.
2. Botão desktop e mobile acima de Automação.
3. Wizard `#meta-tpl-broadcast-panel` movido para `#tab-whatsapp-disparo-cloud`. Templates ficou só lista e criação.
4. CSS, `LABORATORIO_MENU_KEYS`, `getMenuSectionForTab`, `resolveMenuGroupForTab` e `setActiveTab` passaram a tratar a nova aba.
5. Preview `?ui-preview=disparo-cloud` abre a aba nova.
6. Testes de permissão do Laboratório atualizados.

## Solução

- Mozart (master) vê o menu automaticamente.
- Operacional novo (default) também recebe o item via `WABA_TECH_PROVIDER_MENU_IDS`.
- Operacional antigo só vê o menu depois que o master marcar **Disparo Cloud** no cadastro (mesmo padrão dos outros itens novos do registry).

## Arquivos criados/alterados

- `src/menus/waba-menu-registry.ts`
- `src/menus/waba-laboratorio-access.test.ts`
- `index.html`
- `docs/project-memory/00-PROJECT.md`
- `docs/project-memory/01-ARCHITECTURE.md`
- `docs/project-memory/02-BUSINESS_RULES.md`
- `docs/project-memory/05-DECISIONS.md`
- `docs/project-memory/06-CURRENT_STATUS.md`
- `doc/memoria.md`

## Como validar

```bash
npm run test:laboratorio-menu
npm run build
```

Preview local: `http://127.0.0.1:43181/?ui-preview=disparo-cloud`

No painel logado: seção Laboratório → **Disparo Cloud** acima de Automação. Templates não deve mais mostrar o wizard.

## Segurança

Sem novos segredos. Permissão do menu segue o cadastro e a política do Laboratório.

## Palavras-chave

menu, disparo-cloud, laboratorio, whatsapp-disparo-cloud, automacao, templates
