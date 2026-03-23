---
title: backend-saas-api-senior examples
---

# Exemplos de fluxo (controller -> service -> repository)

## 1) Endpoint de leitura (exemplo generico)

```ts
// controller (apenas valida e orquestra)
export async function getX(req: Request, res: Response) {
  const tenantId = req.auth.tenant_id; // obtido do contexto de autenticacao
  const { id } = req.params;

  // validar inputs simples (ex.: id nao vazio)
  if (!id) return res.status(400).json({ error: "invalid_input" });

  const result = await xService.getX({ tenantId, id });
  return res.json(result);
}
```

```ts
// service (regra de negocio e autorizacao)
export async function getX({ tenantId, id }: { tenantId: string; id: string }) {
  const record = await xRepository.findById({ tenantId, id });
  if (!record) {
    // padrao do projeto: 404 para "nao encontrado no tenant"
    throw new NotFoundError("X");
  }

  // mapear para DTO de saida (campos permitidos)
  return { id: record.id, name: record.name };
}
```

```ts
// repository (queries sempre com tenant_id)
export async function findById({ tenantId, id }: { tenantId: string; id: string }) {
  return supabase
    .from("x")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .single();
}
```

## 2) Endpoint de mutacao (exemplo genérico com tenant boundary)

```ts
// service (garantir pertencimento do recurso ao tenant via query com tenant_id)
export async function updateX({ tenantId, id, input }: UpdateXArgs) {
  const existing = await xRepository.findById({ tenantId, id });
  if (!existing) throw new NotFoundError("X");

  // regras de negocio aqui

  await xRepository.update({ tenantId, id, input });
  return xRepository.findById({ tenantId, id });
}
```

```ts
// repository (mutacao restringida a tenant_id)
export async function update({ tenantId, id, input }: UpdateXRepoArgs) {
  return supabase
    .from("x")
    .update(input)
    .eq("tenant_id", tenantId)
    .eq("id", id);
}
```

# Checklist de teste minimo (multi-tenant)

1. Ao solicitar leitura de `id` com `tenant_id` A, nao deve retornar registros do tenant B.
2. Ao tentar atualizar/deletar um registro do tenant B usando `tenant_id` A, o service deve retornar `404` (ou `403`, conforme contrato).
3. Validacoes de entrada devem falhar com `400` antes de acessar o repository.
4. Listagens devem respeitar paginação e limit/offset (ou cursor).

