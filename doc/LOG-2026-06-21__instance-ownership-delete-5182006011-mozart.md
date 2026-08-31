# LOG — Fix exclusão instância 5182006011 (mozart ownership)

**Data:** 2026-06-21

## Pedido

Excluir instância **5182006011** da conta **mozart.pmo@gmail.com**. O sistema retornava **403** — «pertence a outro usuário».

## Causa raiz

1. **Nome técnico ≠ chave de ownership:** na Evolution a instância pode aparecer como `walkup` (ou outro alias), enquanto `instance-owners.json` registra `5182006011` para o Mozart (ou vice-versa).
2. **`canAccessInstance`** usava `resolveOwnerEmailForCandidates`, que devolvia o **primeiro dono encontrado** entre candidatos — se o nome enviado no DELETE era `walkup` (dono walkup), negava mesmo o Mozart possuindo a chave numérica equivalente.
3. **`resolveInstanceDeletionKeys`** não incluía chaves do `instance-owners.json` por match de dígitos do telefone.

## Solução (código)

### `waba-instance-ownership.service.ts`

- `canAccessInstance`: permite acesso se o usuário é dono de **qualquer candidato** (nome + aliases); só nega pelo dono primário ou fallback por dígitos quando não há match direto do requester.

### `src/index.ts`

- `resolveInstanceDeletionKeys`: adiciona chaves registradas em `instance-owners.json` com sufixo numérico compatível (ex.: `5182006011` ↔ `walkup` quando o número bate).
- Corrigida rota `POST /instancias/:name/renomear` (estava acidentalmente como `/admin/instances/transfer-owner`).

### Script operacional

- `scripts/remove-instance-from-subscriber-docker.cjs` — remove ownership + tombstone via `docker exec` quando for preciso limpar dados sem esperar deploy.

## Arquivos alterados

- `src/instances/waba-instance-ownership.service.ts`
- `src/index.ts`
- `src/deploy-marker.ts` → `DEPLOY-2026-06-21-instance-ownership-delete-fix`
- `scripts/remove-instance-from-subscriber-docker.cjs`

## Validar

1. **Build:** `npm run build` ✓
2. **Deploy** Easypanel / push master → `GET /health` com marker `instance-ownership-delete-fix`
3. Login **mozart.pmo@gmail.com** → Instâncias → Deletar `5182006011` (ou nome técnico exibido)
4. Se ainda falhar **antes do deploy**, no SSH:

```bash
CID=$(docker ps -q -f name=waba_waba_disparador -f status=running | head -1)
docker cp scripts/remove-instance-from-subscriber-docker.cjs "$CID:/tmp/"
docker exec "$CID" node /tmp/remove-instance-from-subscriber-docker.cjs \
  --phone 5182006011 --email mozart.pmo@gmail.com --data-dir /app/data
# Reiniciar container se a lista não atualizar
```

## Palavras-chave

`5182006011`, `mozart.pmo@gmail.com`, `instance-owners.json`, `canAccessInstance`, `resolveInstanceDeletionKeys`, ownership alias, delete 403
