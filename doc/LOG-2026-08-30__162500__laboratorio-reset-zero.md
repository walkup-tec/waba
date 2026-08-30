# Laboratório: zerar portfólios e recomeçar a integração

## Contexto do pedido

Apagar todos os portfólios do Laboratório (Drax, Walkup e o card vazio) para integrar de novo pelo Embedded Signup. O Business Manager na Meta não é excluído.

## Ações

- `DELETE /integrations/meta/whatsapp/portfolio` desconecta todas as conexões abertas do tenant, apaga token gravado e identidade local (nome/foto/números)
- A lista só mostra conexão gravada (não inventa card extra da Graph)
- UI: botão **Excluir tudo e recomeçar**
- Marker: `DEPLOY-2026-08-30-162500-master-laboratorio-reset-zero`

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-connection.repository.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio-identity.store.ts`
- `index.html`
- `src/deploy-marker.ts`

## Como validar

1. `npm run test:meta-portfolio` (38 ok)
2. Após push + Redeploy: `GET /health` com o marker acima
3. No Laboratório, **Excluir tudo e recomeçar** → confirmar → some a lista; **Conectar Portfólio** para o Embedded Signup

## Segurança

Token gravado é apagado na linha desconectada. Sem log de segredo. Tenant isolado (só a sessão autenticada).

## Palavras-chave

reset laboratório, disconnectOpenByTenant, excluir portfólio, embedded signup, zero
