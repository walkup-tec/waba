# LOG — Monitor Jandira 2 (disparo 15:32)

## Contexto

Usuário iniciou novo Disparo Cloud da Campanha Jandira 2 em **03/09/2026 15:32:08** (BRT ≈ 18:32 UTC) e pediu monitoramento da correção do cabeçalho.

## Estado no ar (18:33 UTC)

`GET /health` → marker ainda **`DEPLOY-2026-09-03-171800-oficial-dedupe-ai-edit`**.

O tip `7fe3c7d` / marker `DEPLOY-2026-09-03-182400-header-id-template-aprovado` **não está no processo Node** até Redeploy EasyPanel do `waba_disparador`. FTP pode ter enviado ficheiros; o container ainda serve o build antigo.

## O que isso implica

Este lote **não valida** a correção completa (arquivo local obrigatório + anexar foto no template aprovado). Pode repetir 131053 se o cabeçalho continuar só com lookaside.

## Critério de sucesso (quando houver JSON)

- `delivered` / `read` > 0
- `errorCode` 131053 **não** dominante
- Falha: `delivered: 0` + muitos `131053`

## Comando VPS (colar saída)

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
console.log(JSON.stringify({id:c.id,status:c.status,voidedAt:c.voidedAt||null,createdAt:c.createdAt,sendStartedAt:c.sendStartedAt,total:c.total,sent:c.sent,failed:c.failed,skipped:c.skipped,delivered:leads.filter(l=>l.metaStatus==="delivered"||l.metaStatus==="read").length,wamid:leads.filter(l=>l.wamid).length,codes},null,2));
'
```

## Palavras-chave

jandira 2, monitor, 15:32, deployMarker 171800, 131053
