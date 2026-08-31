# LOG — Aquecedor: Soma Promotora fora do ciclo

**Data:** 2026-06-08  
**Sintoma:** Só drax-sistemas ↔ walkup no aquecedor; Soma Promotora ignorada.

## Causas possíveis (filtro em cascata)

1. **Dono** — `instance-owners.json`: instância precisa estar no e-mail de quem iniciou o aquecedor.
2. **Conexão** — Evolution `connectionStatus: open`.
3. **Número** — `ownerJid` / número extraído (sem número = excluída).
4. **Painel** — checkbox «Aquecedor» em Instâncias (`instancias_uso_config.use_aquecedor`).
5. **Bug corrigido** — `buildConnectedFromEvoResponse` usava `name` antes de `instanceName`; a UI usa o contrário. Se `name` = perfil WhatsApp («Soma Promotora») e `instanceName` = `soma-promotora`, o dono não casava.

## Correção

- `resolveEvoInstanceKey()` — mesma ordem que `/instancias`.
- `GET /aquecedor/diagnostico` → `instancias.eligible` / `instancias.excluded` com motivos.
- Marker: `DEPLOY-2026-06-08-aquecedor-pair-and-instances`.

## Validar em produção

`GET /aquecedor/diagnostico` (logado) → ver `instancias.excluded` para Soma.

## Pendências

- Deploy + reiniciar aquecedor
- Se `nao_encontrada_na_evolution` ou sem dono: integrar de novo ou editar `instance-owners.json`
