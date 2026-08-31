# LOG — parar aquecedor produção (validação pendente)

**Data:** 2026-06-09  
**Pedido:** Parar imediatamente o aquecedor em produção; não enviar nem receber mensagens; validações depois.

## Ações executadas (produção `https://waba.draxsistemas.com.br`)

| Ação | Endpoint | Resultado |
|------|----------|-----------|
| Parar motor aquecedor | `POST /aquecedor/stop` | `running: false`, `runtime-intent` → desligado |
| Parar envios gerais | `POST /disparos/parar-envios` | Aquecedor parado; 0 campanhas em execução |
| Desabilitar instâncias | `POST /instancias/uso-config` | Walkup, Geovana novo, Marcelo Pessoal → `useAquecedor: false`, `useDisparador: false` |

## Estado após parada

- **Motor:** `running: false`, `isProcessing: false`
- **Instâncias EVO:** 3 conectadas (`open`) — números ainda online no WhatsApp
- **Fila Supabase:** ~38.459 mensagens `PENDENTE` (não serão processadas com motor parado + instâncias desabilitadas)
- **Último ciclo:** teste às `2026-06-09T19:11:05Z` — Walkup → 2 destinos (antes da parada)
- **Janela humanizada:** aberta (irrelevante com motor parado)

## Garantias pós-restart

- `runtime-intent.json` gravado como **desligado** → após redeploy o motor **não** sobe sozinho
- Instâncias com `useAquecedor: false` → mesmo se alguém clicar Iniciar, ciclo falha com "Menos de 2 instâncias habilitadas"

## Pendências (validação do possível erro)

- Investigar causa do erro reportado pelo usuário
- Conferir logs Evolution / último `lastEvoError`
- Decidir se limpa fila `PENDENTE` antiga no Supabase
- **Nota:** instâncias continuam conectadas — tráfego WhatsApp externo (fora do aquecedor) ainda pode chegar; desconectar exige ação separada na Evolution

## Comandos de verificação

```powershell
Invoke-RestMethod "https://waba.draxsistemas.com.br/aquecedor/status"
Invoke-RestMethod "https://waba.draxsistemas.com.br/aquecedor/diagnostico"
Invoke-RestMethod "https://waba.draxsistemas.com.br/instancias/uso-config"
```
