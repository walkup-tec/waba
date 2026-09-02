# LOG — Workspace do Laboratório para o operacional

## Contexto

`drax@draxsistemas.com.br` já via o menu Laboratório, mas Conexão ficava no passo 1 (sem portfólio), sem números e Templates vazio.

## Causa

O tenant Meta vem do e-mail da sessão. As conexões estão no tenant do dono (`mozart.pmo@gmail.com`). O operacional lia outro `tenant_id`.

## Solução

`resolveMetaWhatsappTenant`: operacional/suporte com pelo menos um menu do Laboratório usa o workspace do dono. Assinante e master continuam no próprio e-mail.

## Como validar

```bash
npm run test:meta-phase2
```

Após Redeploy: login operacional com Laboratório marcado → mesmos cards de portfólio, chips de número e templates do dono.

Marker: `DEPLOY-2026-09-02-133400-laboratorio-workspace-operacional`

## Palavras-chave

Laboratório, tenant, operacional, portfólio, números, templates, mozart.pmo
