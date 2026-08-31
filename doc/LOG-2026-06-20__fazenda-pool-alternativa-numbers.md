# LOG — Fazenda master + pool números Alternativa (V02)

**Data:** 2026-06-20

## Regra de negócio

1. **Master:** coluna **Fazenda** na listagem de Instâncias (toggle igual Aquecedor/Disparador).
2. **Assinante:** após comprar N números, pode atribuir até N instâncias da **fazenda master** (marcadas como Fazenda, conectadas, livres).
3. Números vêm do aquecedor dos masters — não QR próprio do assinante na aba Comprar números.

## Backend

- `InstanceUsageConfig.useFazenda` + coluna Supabase `use_fazenda` (fallback memória).
- `WabaFazendaPoolService` — pool master, validação de ativação, filtro disparador (owned + activations).
- `GET /billing/alternativa-numbers/summary` → `fazendaPool` (items, availableToClaim, assignedToSubscriber).
- `POST .../activate` valida fazenda master e slot disponível.

## Frontend

- Coluna Fazenda só para `hasMasterAccess()`.
- Aba **Comprar números:** picker usa pool da fazenda; botão → ativa slot.

## Supabase (se aplicável)

```sql
ALTER TABLE instancias_uso_config ADD COLUMN IF NOT EXISTS use_fazenda boolean DEFAULT false;
```

## Pendências

- Commit/deploy
- Master marcar instâncias como Fazenda e validar assinante walkup
