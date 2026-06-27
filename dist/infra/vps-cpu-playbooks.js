"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePlaybookForServiceKey = exports.resolveServiceKeyFromContainerName = void 0;
const traefikAccessLogPlaybook = {
    id: "traefik-accesslog",
    label: "Traefik — access log / API",
    summary: "Traefik com access log ou dashboard ativo consome CPU por requisição.",
    steps: [
        {
            order: 1,
            title: "Confirmar envs atuais",
            command: "docker service inspect easypanel-traefik --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep -iE 'TRAEFIK_(ACCESSLOG|API)'",
        },
        {
            order: 2,
            title: "Desligar access log e dashboard (snapshot hPanel antes)",
            command: "docker service update --env-rm TRAEFIK_ACCESSLOG TRAEFIK_API_DASHBOARD TRAEFIK_API_INSECURE --env-add TRAEFIK_ACCESSLOG=false --env-add TRAEFIK_API_DASHBOARD=false --env-add TRAEFIK_API_INSECURE=false easypanel-traefik",
        },
        {
            order: 3,
            title: "Validar WABA HTTPS",
            command: 'curl -sS -o /dev/null -w "https: %{http_code}\\n" --resolve waba.draxsistemas.com.br:443:127.0.0.1 https://waba.draxsistemas.com.br/health',
        },
        {
            order: 4,
            title: "Medir CPU Traefik",
            command: 'docker stats --no-stream --format "{{.Name}} {{.CPUPerc}}" | grep -i traefik',
        },
    ],
};
const typebotPlaybook = {
    id: "typebot-stack",
    label: "Typebot — stack completa",
    summary: "Typebot usa vários containers (builder, viewer, db, minio). Pausar se não estiver em uso diário.",
    steps: [
        {
            order: 1,
            title: "Listar serviços Typebot",
            command: "docker service ls | grep -i typebot",
        },
        {
            order: 2,
            title: "Parar serviços (Easypanel → projeto typebot → Stop) ou via SSH",
            command: "docker service ls --format '{{.Name}}' | grep -i '^typebot_' | xargs -r docker service rm",
            note: "Preferível pausar pelo Easypanel para manter config. Comando acima remove do Swarm.",
        },
        {
            order: 3,
            title: "Confirmar CPU após parada",
            command: "docker stats --no-stream --format 'table {{.Name}}\\t{{.CPUPerc}}' | head -12",
        },
    ],
};
const easypanelPlaybook = {
    id: "easypanel-panel",
    label: "Easypanel — painel de controle",
    summary: "Easypanel consome CPU proporcional ao número de serviços Swarm geridos.",
    steps: [
        {
            order: 1,
            title: "Ver quantos serviços existem",
            command: "docker service ls",
        },
        {
            order: 2,
            title: "Limitar CPU do painel (opcional)",
            command: "docker service update --limit-cpu 1.0 easypanel",
            note: "Painel pode ficar mais lento; protege o VPS.",
        },
        {
            order: 3,
            title: "Remover apps ociosos no Easypanel",
            command: "# Easypanel UI → Stop/Destroy serviços não usados (Typebot, staging, etc.)",
        },
    ],
};
const n8nPlaybook = {
    id: "n8n",
    label: "n8n — automações",
    summary: "Workflows agendados mantêm n8n ativo mesmo sem usuários.",
    steps: [
        {
            order: 1,
            title: "Localizar serviço",
            command: "docker service ls | grep -i n8n",
        },
        {
            order: 2,
            title: "Remover serviço",
            command: "docker service rm walkup_n8n",
            note: "Ajuste o nome se diferente. Desative workflows antes se quiser preservar export.",
        },
        {
            order: 3,
            title: "Apagar volumes órfãos (opcional)",
            command: "docker volume ls | grep -i n8n",
        },
    ],
};
const chatwootPlaybook = {
    id: "chatwoot",
    label: "Chatwoot — atendimento",
    summary: "Sidekiq + Puma consomem CPU mesmo com poucos agentes.",
    steps: [
        {
            order: 1,
            title: "Listar serviços Chatwoot",
            command: "docker service ls | grep -i chatwoot",
        },
        {
            order: 2,
            title: "Remover stack",
            command: "docker service rm walkup_chatwoot-sidekiq walkup_chatwoot-walkup walkup_chatwoot-redis-walkup walkup_chatwoot-db-walkup",
        },
        {
            order: 3,
            title: "Validar WABA",
            command: 'curl -sS -o /dev/null -w "https: %{http_code}\\n" --resolve waba.draxsistemas.com.br:443:127.0.0.1 https://waba.draxsistemas.com.br/health',
        },
    ],
};
const dockerDaemonPlaybook = {
    id: "docker-daemon",
    label: "Docker daemon",
    summary: "dockerd alto após muitos redeploys — restart controlado com snapshot.",
    steps: [
        {
            order: 1,
            title: "Snapshot hPanel",
            command: "# hPanel → Snapshot → Novo snapshot",
        },
        {
            order: 2,
            title: "Restart Docker",
            command: "systemctl restart docker",
            note: "Aguarde 60s. Swarm sobe serviços automaticamente.",
        },
        {
            order: 3,
            title: "Validar Traefik + WABA",
            command: "docker service ls | grep -E 'traefik|waba_disparador' && curl -sS http://127.0.0.1:30180/health | head -c 120",
        },
    ],
};
const wabaAppPlaybook = {
    id: "waba-app",
    label: "WABA — aplicação",
    summary: "CPU alta no WABA: aquecedor ativo, disparador ou muitas instâncias Evolution.",
    steps: [
        {
            order: 1,
            title: "Health e marker",
            command: "curl -sS http://127.0.0.1:30180/health",
        },
        {
            order: 2,
            title: "Parar aquecedor na UI (master/assinante) se em teste",
            command: "# WABA → Aquecedor → Parar",
        },
        {
            order: 3,
            title: "Logs recentes do container",
            command: "docker service logs waba_waba_disparador --tail 40",
        },
    ],
};
const genericPlaybook = {
    id: "generic",
    label: "Diagnóstico geral",
    summary: "Identificar processo/container com maior CPU.",
    steps: [
        {
            order: 1,
            title: "Top containers",
            command: "docker stats --no-stream --format '{{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}' | sort -t$'\\t' -k2 -hr | head -15",
        },
        {
            order: 2,
            title: "Top processos host",
            command: "ps aux --sort=-%cpu | head -12",
        },
        {
            order: 3,
            title: "Load e uptime",
            command: "uptime && nproc",
        },
    ],
};
const resolveServiceKeyFromContainerName = (name) => {
    const n = String(name || "").toLowerCase();
    if (n.includes("easypanel-traefik") || n.includes("traefik"))
        return "traefik";
    if (n.includes("chatwoot") || n.includes("sidekiq") || n.includes("puma"))
        return "chatwoot";
    if (n.includes("n8n"))
        return "n8n";
    if (n.includes("typebot"))
        return "typebot";
    if (n.includes("easypanel.") && !n.includes("traefik"))
        return "easypanel";
    if (n.includes("waba_disparador") || n.includes("waba-disparador"))
        return "waba";
    if (n.includes("evo-walkup") || n.includes("walkup-api"))
        return "evolution";
    if (n.includes("dockerd") || n === "dockerd")
        return "docker";
    return "generic";
};
exports.resolveServiceKeyFromContainerName = resolveServiceKeyFromContainerName;
const resolvePlaybookForServiceKey = (serviceKey) => {
    switch (serviceKey) {
        case "traefik":
            return traefikAccessLogPlaybook;
        case "typebot":
            return typebotPlaybook;
        case "easypanel":
            return easypanelPlaybook;
        case "n8n":
            return n8nPlaybook;
        case "chatwoot":
            return chatwootPlaybook;
        case "docker":
            return dockerDaemonPlaybook;
        case "waba":
            return wabaAppPlaybook;
        default:
            return genericPlaybook;
    }
};
exports.resolvePlaybookForServiceKey = resolvePlaybookForServiceKey;
