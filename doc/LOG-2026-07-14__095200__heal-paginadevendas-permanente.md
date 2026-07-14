# LOG — Heal permanente paginadevendas (anti 502 pós-redeploy)

## Pedido
Usuário: 502 / `Cannot GET /api/errors/bad-gateway` não pode voltar a acontecer após deploy da landing.

## Solução v2
`scripts/heal-paginadevendas-pos-redeploy-vps.sh` — mesmas 3 camadas do login heal:
1. **Watch** `waba-paginadevendas-heal-watch.service` — docker events → burst
2. **Timer** `waba-paginadevendas-heal.timer` — ~20s
3. **Burst/run** — publish `:30210→3000` + backends `172.17.0.1:30210` + HUP

Rule: `.cursor/rules/waba-paginadevendas-heal-pos-redeploy.mdc`  
Workflow: `.github/workflows/heal-paginadevendas-on-deploy.yml`

## Install obrigatório (VPS, uma vez)
```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/heal-paginadevendas-pos-redeploy-vps.sh" \
  -o /tmp/heal-paginadevendas-pos-redeploy-vps.sh
sed -i 's/\r$//' /tmp/heal-paginadevendas-pos-redeploy-vps.sh
chmod +x /tmp/heal-paginadevendas-pos-redeploy-vps.sh
/tmp/heal-paginadevendas-pos-redeploy-vps.sh install
systemctl is-active waba-paginadevendas-heal-watch.service
```

## Keywords
paginadevendas heal permanente, 30210, bad-gateway, watch burst
