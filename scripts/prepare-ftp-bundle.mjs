/**
 * Monta a pasta ftp-bundle/ com build + dependências de produção para você
 * compactar e enviar ao servidor (FTP, etc.).
 *
 * Uso: npm run bundle:ftp
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const out = path.join(root, "ftp-bundle");

function rimraf(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

console.log("[bundle:ftp] npm run build");
execSync("npm run build", { cwd: root, stdio: "inherit" });

console.log("[bundle:ftp] limpando e criando ftp-bundle/");
rimraf(out);
fs.mkdirSync(out, { recursive: true });

for (const f of ["package.json", "package-lock.json"]) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) {
    console.error("Falta:", f);
    process.exit(1);
  }
  fs.copyFileSync(p, path.join(out, f));
}

const distSrc = path.join(root, "dist");
if (!fs.existsSync(path.join(distSrc, "index.js"))) {
  console.error("dist/index.js não encontrado após build.");
  process.exit(1);
}
copyDir(distSrc, path.join(out, "dist"));

const dataSrc = path.join(root, "data");
const dataDest = path.join(out, "data");
if (fs.existsSync(dataSrc)) {
  copyDir(dataSrc, dataDest);
} else {
  fs.mkdirSync(dataDest, { recursive: true });
}

const envExample = path.join(root, ".env.example");
if (fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, path.join(out, "ENV-EXEMPLO.txt"));
}

console.log("[bundle:ftp] npm ci --omit=dev (dentro de ftp-bundle/)");
execSync("npm ci --omit=dev", { cwd: out, stdio: "inherit" });

const readme = `WABA / Disparador — pacote para publicar
${"=".repeat(44)}

CONTEÚDO
  dist/           → aplicação (iniciar com: node dist/index.js)
  data/           → estado local (campanhas, aliases); o servidor pode gravar aqui
  node_modules/   → dependências de produção (geradas por npm run bundle:ftp)
  package.json + package-lock.json

SEGURANÇA — .env
  Não publique senhas em repositório público.
  No servidor, crie o arquivo .env na MESMA pasta que package.json.
  Use ENV-EXEMPLO.txt (se existir neste pacote) como modelo.

EXECUTAR (servidor com Node.js 18+)
  cd pasta-onde-você-descompactou
  node dist/index.js

  Variáveis comuns: PORT=3000 e as chaves do seu .env (Supabase, Meta, EVO, OpenAI, etc.).

FTP × NODE
  Hospedagem compartilhada só com FTP (só PHP/arquivos estáticos) em geral NÃO executa Node.
  Prefira VPS, Easypanel, Railway, Render, ou similar com Node habilitado.

HTTPS
  O botão "Conectar com Meta" exige site aberto em https://

Gerado em: ${new Date().toISOString()}
`;

fs.writeFileSync(path.join(out, "LEIA-ME.txt"), readme, "utf8");

console.log("[bundle:ftp] OK → pasta:", out);
console.log("[bundle:ftp] Compacte ftp-bundle em .zip e envie, ou suba a pasta inteira via FTP.");
