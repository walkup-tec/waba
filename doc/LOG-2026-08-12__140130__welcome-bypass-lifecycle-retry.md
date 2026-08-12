# LOG — Boas-vindas WhatsApp ignora Preparando / pausa humana + retry

## Contexto do pedido

Mensagem de boas-vindas WhatsApp aos assinantes (DRAX) deve ser enviada mesmo quando o número/instância de origem estiver em **Preparando** ou **3 horas pausa humana** do aquecedor. A boas-vindas **não pode falhar**.

## Investigação

- Sintoma esperado: envio de boas-vindas bloqueado ou falhando quando a instância está em lifecycle do aquecedor.
- Caminho: `deliverSubscriberWelcomeWhatsApp` → `deliverWabaEvolutionWhatsApp` (hints `51981077770` → …).
- Evidência: o fluxo de mail **não** chamava `canAquecedorInstanceSendToday` / `filterInstancesLifecycleReady` (só aquecedor/campanhas Alternativa usam isso).
- Lacuna real de confiabilidade: boas-vindas **não** tinham `backgroundRetryKey` (operacional campanha já tem) — após as rodadas síncronas o status podia ficar `failed` sem retry até sucesso.
- Confiança na hipótese: **Alta** (código no path de boas-vindas vs aquecedor).

## Solução implementada

1. `ignoreAquecedorLifecycle: true` nas boas-vindas (assinante e equipe):
   - documenta/garante que Preparando / pausa humana **não** bloqueiam;
   - loga quando envia apesar dessas fases;
   - se os hints preferidos estiverem offline, fallback para qualquer EVO conectada.
2. `backgroundRetryKey` (`welcome:subscriber|staff:email:whatsapp`) — retry em background até `sent`.
3. Marker: `DEPLOY-2026-08-12-welcome-bypass-lifecycle`.

## Arquivos

- `src/mail/waba-welcome-whatsapp.service.ts`
- `src/mail/waba-evolution-whatsapp-delivery.service.ts`
- `src/deploy-marker.ts`
- `dist/` (build)

## Como validar

1. Redeploy EasyPanel `waba_disparador`; `GET /health` com marker `DEPLOY-2026-08-12-welcome-bypass-lifecycle`.
2. Com uma instância dos hints em Preparando ou pausa humana (mas `connectionState=open`), reenviar boas-vindas no Admin.
3. Logs: `[whatsapp] boas-vindas: enviando via … apesar de aquecedor «…»` e/ou `retry em background até sucesso`.
4. Assinante recebe o WhatsApp.

## Segurança

Sem exposição de segredos; retry só em memória do processo (reinício do container reinicia a fila — preferir instâncias open).

## Palavras-chave

`boas-vindas`, `ignoreAquecedorLifecycle`, `preparando`, `pausa humana`, `backgroundRetryKey`, `welcome-bypass-lifecycle`
