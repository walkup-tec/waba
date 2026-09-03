# LOG — Jandira 2 travou em 357/1990 (Enviando)

## Sintoma

UI Disparo Cloud: **Campanha Jandira 2**, Cleison, início `03/09/2026, 15:51:19`, progresso **357 / 1990**, status **Enviando**.

## Hipótese

O loop `runCampaign` vive só em memória (`running` Set). **Não há resume no boot.** Redeploy EasyPanel mata o processo; o JSON fica `status: "running"` e a UI continua «Enviando» no último `sent+failed`.

## Evidências

| Item | Valor |
|------|--------|
| Início campanha | 15:51:19 BRT = **18:51:19 UTC** |
| `serverBootId` produção | `mtlwxm2b-…` → boot **19:23:23 UTC** |
| Marker no ar | `DEPLOY-2026-09-03-191200-video-header-upload` |
| Código | `runCampaign` sem retomada; `cloudBroadcastDisplayStatus(running)` → «Enviando» |
| SSH agente | sem `VPS_SSH_PRIVATE_KEY` — JSON de produção não lido daqui |

Confiança: **Alta** (órfão pós-Redeploy). Contagem exata de `delivered` / `131053` depende do dump VPS.

## Impacto

Número Cloud do portfólio permanece **ocupado** enquanto o broadcast estiver `running` sem `voidedAt`.

## Inspeção no VPS

```bash
CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | grep -vE 'v01|v02' | head -1)"
docker exec "$CONTAINER" node -e '
const fs=require("fs");
const s=JSON.parse(fs.readFileSync("/app/data/meta-whatsapp-broadcasts.json","utf8"));
const rows=(s.campaigns||[]).filter(c=>String(c.intakeCampaignId||"")==="368d053b-d59b-4eed-a235-fe9e9f32c68c"||/jandira/i.test(String(c.templateName||c.name||"")));
rows.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
const c=rows[0];
if(!c){console.log("none");process.exit(0)}
const leads=c.leads||[];
const codes={};
for(const l of leads){const k=String(l.errorCode||l.metaStatus||l.status||"?");codes[k]=(codes[k]||0)+1}
console.log(JSON.stringify({id:c.id,status:c.status,voidedAt:c.voidedAt||null,createdAt:c.createdAt,sendStartedAt:c.sendStartedAt,sendFinishedAt:c.sendFinishedAt||null,total:c.total,sent:c.sent,failed:c.failed,skipped:c.skipped,delivered:leads.filter(l=>l.metaStatus==="delivered"||l.metaStatus==="read").length,wamid:leads.filter(l=>l.wamid).length,queued:leads.filter(l=>l.status==="queued"||(!l.status&&!l.wamid)).length,codes},null,2));
'
```

## Se confirmado `running` órfão (void + restart)

Substituir `BROADCAST_ID` pelo `id` do dump:

```bash
CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | grep -vE 'v01|v02' | head -1)"
docker exec "$CONTAINER" node -e '
const fs=require("fs");
const p="/app/data/meta-whatsapp-broadcasts.json";
const s=JSON.parse(fs.readFileSync(p,"utf8"));
const id="BROADCAST_ID";
const now=new Date().toISOString();
for (const c of s.campaigns||[]) {
  if (c.id!==id) continue;
  c.status="failed";
  c.voidedAt=c.voidedAt||now;
  c.sendFinishedAt=now;
  c.updatedAt=now;
}
fs.writeFileSync(p, JSON.stringify(s));
console.log("voided", id);
'
docker restart "$CONTAINER"
```

Não iniciar outro Disparo Cloud sem header local anexado e número liberado.

## Palavras-chave

jandira 2, 357, travou, Enviando, redeploy, orphan running, void
