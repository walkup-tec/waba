# LOG — Admin: excluir assinante (UI + purge completo)

**Data:** 2026-07-02  
**Marker:** `DEPLOY-2026-07-02-admin-assinante-excluir-ui`

## Contexto

Usuário reportou que `digitalcorban@gmail.com` **não foi excluído**. O endpoint `DELETE /admin/subscribers/by-email/:email` existia desde `4b941b6`, mas:

1. **Deploy não executa exclusão** — só publica código; a remoção precisa ser acionada manualmente.
2. **Não havia botão na UI** — master precisava rodar `fetch` no console.
3. **Purge incompleto** — `digitalcorban` também era usuário **operacional** em `waba-system-users.json`; a purge antiga só removia assinante.

## Solução

1. Botão **Excluir assinante** no modal de detalhe (Admin · Assinantes).
2. `DELETE /admin/subscribers/:subscriberId` (resolve e-mail e chama purge).
3. Purge estendida: remove usuário staff (operacional/suporte) com mesmo e-mail; **nunca** remove `master`.
4. Script `delete-subscriber-by-email.cjs` alinhado.

## Excluir agora (produção)

**Opção A — após redeploy** (`a0b7269`): Admin · Assinantes → clicar na linha → **Excluir assinante**.

**Opção B — imediato (já no ar desde 4b941b6):** logado como master, console:

```javascript
fetch('/admin/subscribers/by-email/digitalcorban%40gmail.com', {
  method: 'DELETE',
  credentials: 'same-origin',
}).then(r => r.json()).then(console.log)
```

Resposta esperada: `{ ok: true, subscriberRemoved: true, ... }`. Se `404`, e-mail já não está em assinantes.

## Arquivos

- `index.html`
- `src/admin/waba-admin-subscriber-purge.service.ts`
- `src/admin/waba-admin.routes.ts`
- `scripts/delete-subscriber-by-email.cjs`
- `src/deploy-marker.ts`

## Palavras-chave

`deleteAdminSubscriberDetail`, `purgeByEmail`, `systemUserRemoved`, `digitalcorban`
