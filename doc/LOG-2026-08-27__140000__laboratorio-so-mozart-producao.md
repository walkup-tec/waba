# LOG — Laboratório só para Mozart em produção

## Contexto do pedido

No painel de gestão em produção, `walkup@walkuptec.com.br` e `quantumivst@gmail.com` não devem ver a seção Laboratório nem os menus abaixo. Só `mozart.pmo@gmail.com` vê essa seção.

## Causa

Masters recebem todos os menus (`resolveEffectiveMenuPermissions`) e o front ignora `allowedMenuIds` para o papel master. A seção `lab-api-oficial` aparece para qualquer master na UI production.

## Solução

1. Allowlist `mozart.pmo@gmail.com` quando o perfil de UI é production.
2. Permissões efetivas zeram `whatsapp-oficial`, `whatsapp-inbox`, `whatsapp-templates`, `whatsapp-automation` para os demais.
3. Classe `waba-laboratorio-visible` no `index.html` (mesmo padrão de Device Cloud).
4. Abas do Laboratório bloqueadas se o usuário não estiver na allowlist.

## Arquivos

- `src/menus/waba-laboratorio-access.ts` (+ teste)
- `src/menus/waba-menu-permissions.service.ts`
- `src/auth/waba-staff-menu-auth.ts`
- `index.html` / `dist/index.html`
- `package.json` (`test:laboratorio-menu`)

## Como validar

1. `npm run test:laboratorio-menu`
2. Após deploy: login walkup e quantumivst → seção Laboratório ausente.
3. Login Mozart → Laboratório visível (Conexão, Inbox, Templates, Automação).

Ainda depende de login real em produção.

## Palavras-chave

`Laboratório`, `lab-api-oficial`, `mozart.pmo@gmail.com`, `menu master`, `waba-laboratorio-visible`
