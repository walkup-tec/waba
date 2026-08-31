/**
 * Gera arquivos .sql para importar mensagens do aquecedor no Supabase SQL Editor.
 * Corrige texto com encoding quebrado (UTF-8 lido como Latin-1 / Windows-1252).
 *
 * Uso:
 *   node scripts/generate-aquecedor-import-sql.cjs "D:\Waba\media\Aquecimento BD.csv"
 */
const fs = require("fs");
const path = require("path");

const ROWS_PER_FILE = 1000;
const FALLBACK_MARKERS = [
  "automática do aquecedor",
  "teste do aquecedor",
  "teste de integração waba",
  "sua primeira mensagem aqui",
  "sua segunda mensagem aqui",
];

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  fields.push(current);
  return fields;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function looksLikeMojibake(text) {
  return /(?:Ã.|Â.|â€™|â€œ|â€)/.test(text);
}

function fixUtf8Text(text) {
  let value = String(text || "").trim();
  if (!value) return "";

  value = value.replace(/^\uFEFF/, "");

  if (looksLikeMojibake(value)) {
    const repaired = Buffer.from(value, "latin1").toString("utf8");
    if (repaired && !looksLikeMojibake(repaired)) {
      value = repaired;
    }
  }

  return value.normalize("NFC");
}

function isSystemMessage(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return true;
  return FALLBACK_MARKERS.some((marker) => value.includes(marker));
}

function sqlLiteral(text) {
  return `'${String(text).replace(/'/g, "''")}'`;
}

function readCsvMessages(filePath) {
  const buffer = fs.readFileSync(filePath);
  let raw = buffer.toString("utf8");

  if (looksLikeMojibake(raw.slice(0, 2000))) {
    raw = buffer.toString("latin1");
  }

  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error("CSV vazio.");

  const header = parseCsvLine(lines[0]).map(normalizeHeader);
  const messageIndex = header.findIndex((name) =>
    ["mensagem", "message", "message_text", "texto", "text"].includes(name)
  );
  if (messageIndex < 0) {
    throw new Error(`Coluna "mensagem" não encontrada. Cabeçalho: ${lines[0]}`);
  }

  const unique = new Set();
  for (let index = 1; index < lines.length; index += 1) {
    const columns = parseCsvLine(lines[index]);
    const message = fixUtf8Text(columns[messageIndex]);
    if (!message || isSystemMessage(message)) continue;
    unique.add(message);
  }

  return Array.from(unique);
}

function writeSetupSql(outputDir) {
  const setup = `-- Execute PRIMEIRO no SQL Editor (UTF-8)
-- Limpa importações antigas com encoding quebrado e recria índice único

create table if not exists public.aquecedor_message_templates (
  id uuid primary key default gen_random_uuid(),
  message_text text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_aquecedor_message_templates_text_unique
  on public.aquecedor_message_templates (message_text);

truncate table public.aquecedor_message_templates restart identity;

select 'Tabela pronta para importação' as status;
`;
  fs.writeFileSync(path.join(outputDir, "00-setup.sql"), setup, "utf8");
}

function writeImportParts(outputDir, messages) {
  const files = [];
  const totalParts = Math.ceil(messages.length / ROWS_PER_FILE);

  for (let part = 0; part < totalParts; part += 1) {
    const chunk = messages.slice(part * ROWS_PER_FILE, (part + 1) * ROWS_PER_FILE);
    const partNumber = String(part + 1).padStart(3, "0");
    const fileName = `${partNumber}-import.sql`;
    const values = chunk.map((message) => `  (${sqlLiteral(message)}, true)`).join(",\n");

    const sql = `-- Parte ${part + 1} de ${totalParts} · ${chunk.length} mensagens
-- Arquivo em UTF-8

insert into public.aquecedor_message_templates (message_text, active)
values
${values}
on conflict (message_text) do nothing;
`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, sql, "utf8");
    files.push(fileName);
  }

  const verify = `-- Execute por ÚLTIMO
select
  count(*) filter (where active) as ativas,
  count(*) as total
from public.aquecedor_message_templates;

select message_text
from public.aquecedor_message_templates
where message_text ilike '%poliniza%'
order by created_at
limit 5;
`;
  fs.writeFileSync(path.join(outputDir, "99-verify.sql"), verify, "utf8");
  files.push("99-verify.sql");

  return files;
}

function main() {
  const csvPath = process.argv[2] || path.join(__dirname, "..", "media", "Aquecimento BD.csv");
  const resolvedPath = path.resolve(csvPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Arquivo não encontrado: ${resolvedPath}`);
    process.exit(1);
  }

  const outputDir = path.join(path.dirname(resolvedPath), "sql-import");
  fs.mkdirSync(outputDir, { recursive: true });

  const messages = readCsvMessages(resolvedPath);
  writeSetupSql(outputDir);
  const files = writeImportParts(outputDir, messages);

  console.log(`CSV: ${resolvedPath}`);
  console.log(`Mensagens únicas: ${messages.length.toLocaleString("pt-BR")}`);
  console.log(`SQL gerado em: ${outputDir}`);
  console.log("");
  console.log("Ordem no SQL Editor do Supabase:");
  console.log("1) 00-setup.sql");
  files
    .filter((name) => /^\d{3}-import\.sql$/.test(name))
    .forEach((name, index) => {
      console.log(`${index + 2}) ${name}`);
    });
  console.log(`${files.length}) 99-verify.sql`);
  console.log("");
  console.log("Amostra corrigida:", messages[1]?.slice(0, 90) || messages[0]?.slice(0, 90));
}

main();
