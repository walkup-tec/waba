# LOG — Laboratório no cadastro do operacional

## Contexto

`drax@draxsistemas.com.br` tinha Conexão, Templates e Automação marcados no modal de usuário, mas a seção Laboratório não aparecia no menu. Só Admin → Campanhas.

## Causa

Em produção o Laboratório ficava preso ao e-mail Mozart (`mozart.pmo@gmail.com`). O backend zerava os menus da seção mesmo quando o cadastro os liberava. O front escondia o grupo por allowlist, sem olhar `allowedMenuIds`.

## Solução

- Operacional/suporte: permissões efetivas seguem o cadastro.
- Master walkup/quantumivst: Laboratório continua oculto.
- Master Mozart: continua vendo.
- Front: `waba-laboratorio-visible` também liga se a sessão tiver algum menu da seção.

## Como validar

```bash
npm run test:laboratorio-menu
```

Após Redeploy: login `drax@draxsistemas.com.br` → seção Laboratório com os itens marcados. Atendimento só aparece se estiver marcado.

Marker: `DEPLOY-2026-09-02-131400-laboratorio-menu-cadastro`

## Palavras-chave

Laboratório, menuPermissions, drax@draxsistemas.com.br, allowedMenuIds, operacional
