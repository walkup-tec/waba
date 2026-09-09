#!/bin/bash
# Duplica uma campanha no container waba_disparador (produção).
# Uso: bash clone-campaign-intake-vps.sh <sourceId> <campaignName> <plannedSendCount> <requestId>
set -euo pipefail

SOURCE_ID="${1:-66c69911-9c2f-42a2-7aeab1b15466}"
NAME="${2:-Opt in PTX}"
COUNT="${3:-1000}"
REQUEST_ID="${4:-opt-in-ptx-1000-20260909}"

CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | grep -vE 'v02|v01' | head -1 || true)"
if [[ -z "$CONTAINER" ]]; then
  CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | head -1 || true)"
fi
if [[ -z "$CONTAINER" ]]; then
  echo "ERRO: container waba_disparador não encontrado"
  docker ps --format '{{.Names}}' | head -20
  exit 1
fi

echo "Container: $CONTAINER"
docker exec "$CONTAINER" node -e '
const crypto=require("crypto");
const fs=require("fs");
const path=require("path");
const XLSX=require("xlsx");
const sourceId=String(process.argv[1]||"").trim();
const wantName=String(process.argv[2]||"").trim();
const planned=Math.max(1, Math.round(Number(process.argv[3]||1000)));
const requestId=String(process.argv[4]||"").trim();
const dataDir="/app/data";
const storeFile=path.join(dataDir,"waba-campaign-intakes.json");
const read=()=>{const raw=JSON.parse(fs.readFileSync(storeFile,"utf8")); if(!raw||raw.version!==1||!Array.isArray(raw.intakes)) throw new Error("Store inválido"); return raw;};
const write=(raw)=>{const tmp=storeFile+"."+process.pid+"."+Date.now()+".tmp"; fs.writeFileSync(tmp, JSON.stringify(raw,null,2)); fs.renameSync(tmp, storeFile);};
const normName=(s)=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();
const raw=read();
const existing=raw.intakes.find((row)=>String(row.clientRequestId||"").trim()==="clone:"+requestId);
if(existing){
  console.log(JSON.stringify({ok:true,skipped:true,requestId,id:existing.id,plannedSendCount:existing.plannedSendCount,campaignName:existing.campaignName,status:existing.status}));
  process.exit(0);
}
let source=sourceId ? raw.intakes.find((row)=>String(row.id||"")===sourceId) : null;
if(!source && wantName){
  const target=normName(wantName);
  const named=raw.intakes.filter((row)=>normName(row.campaignName)===target || normName(row.campaignName).includes(target));
  const withCount=named.filter((row)=>Math.round(Number(row.plannedSendCount||0))===2996);
  source=(withCount[0]||named[0]||null);
}
if(!source) throw new Error("Campanha origem não encontrada: "+JSON.stringify({sourceId,wantName,named:raw.intakes.filter(r=>normName(r.campaignName).includes("PTX")).map(r=>({id:r.id,name:r.campaignName,planned:r.plannedSendCount,createdAt:r.createdAt}))}));
const newId=crypto.randomUUID();
const srcDir=path.join(dataDir,"campaign-intakes", source.id);
const destDir=path.join(dataDir,"campaign-intakes", newId);
fs.mkdirSync(destDir, {recursive:true});
if(fs.existsSync(srcDir)){
  for(const name of fs.readdirSync(srcDir)){
    const from=path.join(srcDir,name);
    const to=path.join(destDir,name);
    if(fs.statSync(from).isFile()) fs.copyFileSync(from,to);
  }
}
const rewrite=(p)=>{
  const value=String(p||"").trim();
  if(!value) return value;
  return value.split(source.id).join(newId);
};
const leadsSrc=source.spreadsheetStoredPath && fs.existsSync(source.spreadsheetStoredPath)
  ? source.spreadsheetStoredPath
  : (source.spreadsheetTrimmedPath && fs.existsSync(source.spreadsheetTrimmedPath) ? source.spreadsheetTrimmedPath : "");
let trimmedName="leads-"+planned+"-envios.xlsx";
let trimmedPath=path.join(destDir, trimmedName);
if(leadsSrc){
  const buf=fs.readFileSync(leadsSrc);
  const fileName=String(source.spreadsheetFileName||leadsSrc);
  const isTxt=fileName.toLowerCase().endsWith(".txt");
  trimmedName="leads-"+planned+"-envios."+(isTxt?"txt":"xlsx");
  trimmedPath=path.join(destDir, trimmedName);
  if(isTxt){
    const lines=buf.toString("utf8").split(/\r\n|\n|\r/).map((l)=>l.trim()).filter(Boolean).slice(0,planned);
    fs.writeFileSync(trimmedPath, lines.length?lines.join("\n")+"\n":"");
  } else {
    const wb=XLSX.read(buf,{type:"buffer"});
    const sheetName=wb.SheetNames[0]||"Leads";
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName]||{},{defval:""}).slice(0,planned);
    const next=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(next, XLSX.utils.json_to_sheet(rows), sheetName);
    fs.writeFileSync(trimmedPath, Buffer.from(XLSX.write(next,{type:"buffer", bookType:"xlsx"})));
  }
}
const now=new Date().toISOString();
const clone=Object.assign({}, source, {
  id:newId,
  plannedSendCount:planned,
  spreadsheetStoredPath:rewrite(source.spreadsheetStoredPath),
  spreadsheetTrimmedPath:trimmedPath,
  spreadsheetTrimmedFileName:trimmedName,
  imageStoredPath:rewrite(source.imageStoredPath),
  whatsappLogoStoredPath:rewrite(source.whatsappLogoStoredPath),
  status:"generated",
  clientRequestId:"clone:"+requestId,
  submissionFingerprint:"clone:"+requestId+":"+planned,
  creditFunding:{fromPaid:planned, fromBonus:0},
  createdAt:now,
  updatedAt:now
});
for (const key of ["startedAt","startedByEmail","performanceReport","errorReport","operacionalNotifyAudit","assignedOperacionalEmail","assignedSupplierId","assignedAt","assignmentHistory","masterOverdueAlertSentAt","supplierPayoutSettlementId","bmInoperanteRegisteredAt","scheduledSendAt"]) {
  delete clone[key];
}
raw.intakes.unshift(clone);
write(raw);
console.log(JSON.stringify({ok:true,requestId,sourceId:source.id,id:newId,campaignName:clone.campaignName,ownerEmail:clone.ownerEmail,plannedSendCount:planned,importedLineCount:clone.importedLineCount,apiKind:clone.apiKind,status:clone.status}));
' "$SOURCE_ID" "$NAME" "$COUNT" "$REQUEST_ID"
