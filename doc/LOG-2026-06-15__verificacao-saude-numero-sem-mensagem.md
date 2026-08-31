# LOG — verificação segura de saúde do número pós-conexão

**Data:** 2026-06-15  
**Pedido:** Forma segura de saber se o número já está sob bloqueio/restrição WhatsApp, sem causar ban.

## Solução

Novo serviço `src/instance-health-check.service.ts` + `POST /instancias/:name/verificar-saude`.

### Verificações passivas (sem sendText)

| Check | Fonte Evolution | O que detecta |
|-------|-----------------|---------------|
| Estado da conexão | `GET /instance/connectionState/{instance}` | `open` vs `close`; `statusReason` **403 = ban/restrição** |
| Instância listada | `GET /instance/fetchInstances` | `connectionStatus: open`, número pareado |
| Perfil WhatsApp | `fetchProfile` / `fetchProfilePictureUrl` | Conta responde na API (sinal de conta ativa) |

### Níveis

- `healthy` + `safeToUse: true` — sem sinais de restrição
- `warning` — conexão instável ou checks incompletos
- `restricted` + `restrictionSuspected: true` — **só com statusReason 403** (sinal forte)

### UI (modal registrar instância)

Após QR conectar (`open`):
1. Chama `verificar-saude` automaticamente
2. Mostra painel com 2 linhas + recomendação
3. **Healthy** → fecha modal
4. **Restricted** → alerta vermelho, modal permanece aberto
5. **Warning** → conectado com ressalvas, usuário revisa antes de disparar

**Nenhuma mensagem é enviada** em nenhum caso.

### Marker

`DEPLOY-2026-06-15-verificacao-saude-numero-v1`

## Limitações honestas

- Não garante 100% que o número pode enviar em massa (só sinais fortes de ban e conexão)
- Teste real de envio continua arriscado; se necessário no futuro: opt-in manual, cooldown 5+ min, envio só para o próprio número
