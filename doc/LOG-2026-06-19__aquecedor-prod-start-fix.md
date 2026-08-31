# LOG — Fix Iniciar Aquecedor em produção (multi-réplica)

**Data:** 2026-06-19  
**Marker:** `DEPLOY-2026-06-19-aquecedor-prod-start-fix`

## Sintoma

V02 (processo único): Iniciar/Pausar OK.  
Produção Easypanel: clique em **Iniciar Aquecedor** não mantém motor ativo na UI.

## Causa

Estado do motor (`running`, `nextAllowedAt`, etc.) ficava **só na memória** de cada container Node. Com load balancer / múltiplas réplicas:

- `POST /aquecedor/start` rodava na réplica A
- `GET /aquecedor/status` (poll 3s) caía na réplica B → `running: false`

V02 local = um processo → sem o problema.

## Correção

**`runtime-intent.json` v2** com `aquecedorRuntimeSnapshot` no volume `/app/data`:

- Status lido do arquivo (visível em todas as réplicas)
- Leader lease (`workerId` + heartbeat 45s) — só um processo executa o intervalo
- Sync de liderança a cada 12s

**UI:** `credentials: "same-origin"` no POST start/stop; cache otimista após start.

## Validar

1. Deploy marker `DEPLOY-2026-06-19-aquecedor-prod-start-fix`
2. Volume `/app/data` montado (runtime-intent persiste)
3. Iniciar → UI mostra **Aquecedor ativo** e permanece após polls
