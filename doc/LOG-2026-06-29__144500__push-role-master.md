# LOG — Push: tipo de usuário Master

## Pedido

Incluir **Master** nos tipos de usuário do Push (há mais de um master; comunicados podem ser só para masters).

## Alterações

- Tipo `WabaPushUserRole`: `"master" | "operacional" | "suporte"`
- UI: checkbox **Master** em Tipos de usuário (desmarcado por padrão)
- `resolveStaffRecipients`: inclui todos os usuários master quando role marcada
- Alertas in-app: master só vê push de usuários se **Master** estiver nos roles do envio (antes via em todo push "users")
- E-mail: removido atalho que adicionava só um master; usa lista por roles

## Validar

Usuários + só Master → alerta/e-mail para contas master; operacional/suporte não recebem.

## Palavras-chave

`push`, `master`, `userRoles`, `admin-push-role-master`
