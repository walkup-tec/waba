"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveUptimePlaybookForTarget = exports.isKnownUptimePlaybookTargetKey = exports.UPTIME_PLAYBOOK_TARGET_KEYS = void 0;
const landingSyncSteps = [
    {
        order: 1,
        title: "Sincronizar rotas WABA (landings)",
        command: "bash /root/traefik-sync-landings-dynamic-vps.sh",
        note: "Reaplica waba-landings-dynamic.yaml e envia HUP ao Traefik.",
    },
    {
        order: 2,
        title: "Conferir log da sincronização",
        command: "tail -20 /var/log/traefik-sync-landings-dynamic.log",
    },
    {
        order: 3,
        title: "Testar HTTPS público",
        command: 'curl -sS -o /dev/null -w "disparos:%{http_code} bet:%{http_code}\\n" --max-time 15 https://wabadisparos.com.br/ https://bet.waba.info/',
    },
    {
        order: 4,
        title: "Se :443 estiver down — bootstrap Traefik",
        command: "bash /root/traefik-easypanel-bootstrap.sh",
        note: "Somente se curl em 127.0.0.1:443 falhar ou Traefik estiver 0/1.",
    },
];
const appWabaSteps = [
    {
        order: 1,
        title: "Health local WABA",
        command: "curl -sS --max-time 10 http://127.0.0.1:30180/health",
    },
    {
        order: 2,
        title: "Reconciliar rota WABA no Traefik",
        command: "bash /root/traefik-permanent-waba-vps.sh run",
        note: "Ajusta Host waba.draxsistemas.com.br → 172.17.0.1:30180.",
    },
    {
        order: 3,
        title: "Bootstrap Traefik (se HTTPS 443 down)",
        command: "bash /root/traefik-easypanel-bootstrap.sh",
    },
];
const siteDraxSteps = [
    {
        order: 1,
        title: "Teste público draxsistemas.com.br",
        command: 'curl -sS -o /dev/null -w "drax:%{http_code}\\n" --max-time 15 https://draxsistemas.com.br/',
        note: "Site pode estar em outro host — confirme DNS e painel do provedor.",
    },
    {
        order: 2,
        title: "Headers e redirect",
        command: "curl -sSI --max-time 15 https://draxsistemas.com.br/ | head -20",
    },
];
const evoSteps = [
    {
        order: 1,
        title: "Status do serviço Evolution",
        command: "docker service ps walkup_evo-walkup --no-trunc | head -8",
        note: "Ajuste o nome do serviço se diferente no Swarm.",
    },
    {
        order: 2,
        title: "fetchInstances local",
        command: 'curl -sS -o /dev/null -w "evo:%{http_code}\\n" --max-time 12 -H "apikey: $EVO_API_KEY" http://127.0.0.1:30181/instance/fetchInstances',
    },
    {
        order: 3,
        title: "Force update (rede/imagem)",
        command: "docker service update --force walkup_evo-walkup",
        note: "Use se tasks estiverem Pending ou rede overlay falhar.",
    },
];
const asaasSteps = [
    {
        order: 1,
        title: "Reexecutar monitor Asaas na UI",
        command: "# Admin → Financeiro → Monitor Asaas → Executar verificação",
    },
    {
        order: 2,
        title: "API (master autenticado)",
        command: "POST /admin/financeiro/asaas-monitor/run",
        note: "Pelo painel WABA ou curl com sessão master.",
    },
];
const playbooks = {
    site_bet: {
        id: "uptime-site-bet",
        label: "bet.waba.info",
        summary: "Landing Bet — roteamento Traefik via arquivo dinâmico WABA.",
        steps: landingSyncSteps,
    },
    site_disparos: {
        id: "uptime-site-disparos",
        label: "wabadisparos.com.br",
        summary: "Landing Disparos — roteamento Traefik via arquivo dinâmico WABA.",
        steps: landingSyncSteps,
    },
    app_waba: {
        id: "uptime-app-waba",
        label: "waba.draxsistemas.com.br",
        summary: "App WABA — backend :30180 e rota Traefik do domínio principal.",
        steps: appWabaSteps,
    },
    site_drax: {
        id: "uptime-site-drax",
        label: "draxsistemas.com.br",
        summary: "Site institucional — pode estar fora deste VPS.",
        steps: siteDraxSteps,
    },
    asaas_webhook: {
        id: "uptime-asaas",
        label: "Asaas (integração/webhook)",
        summary: "Verificação in-app de credenciais, webhook e ambiente.",
        steps: asaasSteps,
    },
    evo_api: {
        id: "uptime-evo",
        label: "Evolution API",
        summary: "Serviço EVO no Swarm e endpoint fetchInstances.",
        steps: evoSteps,
    },
};
exports.UPTIME_PLAYBOOK_TARGET_KEYS = Object.keys(playbooks);
const isKnownUptimePlaybookTargetKey = (key) => exports.UPTIME_PLAYBOOK_TARGET_KEYS.includes(key);
exports.isKnownUptimePlaybookTargetKey = isKnownUptimePlaybookTargetKey;
const resolveUptimePlaybookForTarget = (targetKey) => {
    if (!(0, exports.isKnownUptimePlaybookTargetKey)(targetKey))
        return null;
    return playbooks[targetKey];
};
exports.resolveUptimePlaybookForTarget = resolveUptimePlaybookForTarget;
