# LOG — Heal Sinal Verde isolado (anti-queda Traefik/WABA)

## Contexto

Após correções no CRM Sinal Verde, o usuário restaurou WABA manualmente porque o Traefik ficou 404 em todos os hosts. O workflow `heal-pos-deploy.yml` do `sinal-verde-pro` chamava `restore-easypanel-traefik-backends-vps.sh`, que **patcha o `main.yaml` compartilhado** — conflito com Easypanel + risco de corromper o file provider (404 geral). Scripts referenciados (`sinal-verde-edge-gateway-vps.sh`, `heal-sinal-verde-pos-redeploy-vps.sh`) **não existiam** no repo WABA.

## Solução

1. Novo `scripts/heal-sinal-verde-pos-redeploy-vps.sh` (v1 isolado):
   - Só publish `:30310` + `sinal-verde.yaml` canônico (`http.routers`)
   - Strip SV do `main.yaml` **atômico** (tmp → replace) com validação de braces
   - **Rollback** automático se WABA cair após strip
   - systemd: timer ~20s + watch docker + **`.path`** em `main.yaml` (strip imediato quando Easypanel recria SV)
   - **Proibido** chamar `restore-easypanel-traefik-backends`

2. Workflow SV atualizado (`heal-pos-deploy.yml` v8): remove edge gateway inexistente e `restore-backends`; valida `wabadisparos=200` a cada passagem.

3. Guard overlay v5: delega strip ao heal isolado quando disponível.

## Como validar no VPS

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/HOSTINGER-PASTE-heal-sinal-verde-isolated.sh" \
  -o /tmp/sv-iso.sh && sed -i 's/\r$//' /tmp/sv-iso.sh && bash /tmp/sv-iso.sh
```

Esperado: `disparos:200` e `sv:200|307` — se disparos cair, o script aborta/não insiste em patch WABA.

## Palavras-chave

sinal-verde isolado, main.yaml strip seguro, path unit, restore-backends proibido, anti 404 traefik, heal pós-deploy SV
