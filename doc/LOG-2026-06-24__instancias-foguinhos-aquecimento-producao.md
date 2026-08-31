# LOG — Foguinhos de aquecimento em produção (assinantes)

## Contexto

Pedido: implantar o recurso de foguinhos (nível de aquecimento 0–3) no ambiente de produção para usuários e assinantes. A feature existia no V02 (`Waba-master/dist`) mas não estava no repositório Git de produção (`D:\Waba`).

## Solução

### Backend

- Criado `src/services/aquecedor-instance-warmth.service.ts`:
  - Cálculo de nível 0–3 com base em lifecycle (fase, `activatedAt`, idade) e estatísticas de envio/recebimento 7d (`logs_envios` no Supabase).
  - Labels: Não aquecido, Pouco aquecido, Aquecimento médio, Totalmente aquecido.
  - Overrides opcionais via `data/aquecedor-instance-warmth-overrides.json`.
- `GET /instancias/uso-config` enriquecido com `warmthLevel` e `warmthLabel` por instância.

### Frontend (`index.html`)

- Coluna **Quente** na aba Instâncias (0–3 🔥).
- Picker Disparos → Instâncias do Aquecedor: lista com chips de foguinho + filtro Todos / 1🔥 / 2🔥 / 3🔥.
- CSS `.instance-warmth`, `.dis-picker-list`, `.dis-warmth-chip`, etc.
- Cards «Comprar números» permanecem sem foguinhos (apenas aquecedor).

### Deploy

- Marker: `DEPLOY-2026-06-24-instancias-foguinhos-aquecimento`

## Arquivos alterados

- `src/services/aquecedor-instance-warmth.service.ts` (novo)
- `src/index.ts`
- `src/deploy-marker.ts`
- `index.html`

## Como validar

1. Login como assinante em produção.
2. Aba **Instâncias** → coluna **Quente** com ícones 🔥 (0 a 3 ativos).
3. **Disparos** → Instâncias do Aquecedor → lista com fogos e filtro por nível.
4. `GET /health` → `deployMarker` = `DEPLOY-2026-06-24-instancias-foguinhos-aquecimento`.

## Segurança

- Sem exposição de segredos; queries Supabase limitadas a colunas necessárias.
- Warmth respeita ownership via filtro existente em `/instancias/uso-config`.

## Palavras-chave

`foguinhos`, `warmth`, `aquecimento`, `instancias-coluna-quente`, `dis-picker-warmth-filter`, `aquecedor-instance-warmth`
