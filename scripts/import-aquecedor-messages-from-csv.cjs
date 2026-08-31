/**
 * Importa mensagens do aquecedor (CSV / export do Google Sheets) para Supabase.
 *
 * Uso:
 *   node scripts/import-aquecedor-messages-from-csv.cjs "C:\caminho\arquivo.csv"
 *
 * Variáveis: .env.v02 ou .env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({ path: path.join(__dirname, "..", ".env.v02") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const BATCH_SIZE = 400;
const FALLBACK_MARKERS = [
  "automática do aquecedor",
  "teste do aquecedor",
  "teste de integração waba",
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

function isSystemMessage(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return true;
  return FALLBACK_MARKERS.some((marker) => value.includes(marker));
}

function loadMessagesFromCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) {
    throw new Error("CSV vazio.");
  }

  const header = parseCsvLine(lines[0]).map(normalizeHeader);
  const messageIndex = header.findIndex((name) =>
    ["mensagem", "message", "message_text", "texto", "text"].includes(name)
  );
  if (messageIndex < 0) {
    throw new Error(
      `Coluna de mensagem não encontrada. Cabeçalho: ${lines[0]}. Use uma coluna chamada "mensagem".`
    );
  }

  const unique = new Set();
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const columns = parseCsvLine(lines[lineIndex]);
    const message = String(columns[messageIndex] || "").trim();
    if (!message || isSystemMessage(message)) continue;
    unique.add(message);
  }

  return Array.from(unique);
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error(
      'Informe o caminho do CSV. Ex.: node scripts/import-aquecedor-messages-from-csv.cjs "H:\\Meu Drive\\arquivo.csv"'
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(csvPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Arquivo não encontrado: ${resolvedPath}`);
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env.v02");
    process.exit(1);
  }

  const messages = loadMessagesFromCsv(resolvedPath);
  if (!messages.length) {
    console.error("Nenhuma mensagem válida encontrada no CSV.");
    process.exit(1);
  }

  console.log(`Arquivo: ${resolvedPath}`);
  console.log(`Mensagens únicas para importar: ${messages.length.toLocaleString("pt-BR")}`);
  console.log(`Destino: ${supabaseUrl}`);

  const supabase = createClient(supabaseUrl, supabaseKey);
  let inserted = 0;
  let skipped = 0;

  for (let offset = 0; offset < messages.length; offset += BATCH_SIZE) {
    const batch = messages.slice(offset, offset + BATCH_SIZE).map((message_text) => ({
      message_text,
      active: true,
    }));

    const { data, error } = await supabase
      .from("aquecedor_message_templates")
      .upsert(batch, { onConflict: "message_text", ignoreDuplicates: true })
      .select("id");

    if (error) {
      console.error("Erro no lote:", error.message);
      process.exit(1);
    }

    const batchInserted = Array.isArray(data) ? data.length : 0;
    inserted += batchInserted;
    skipped += batch.length - batchInserted;

    const progress = Math.min(offset + BATCH_SIZE, messages.length);
    console.log(
      `Progresso: ${progress.toLocaleString("pt-BR")}/${messages.length.toLocaleString("pt-BR")} · inseridas no lote: ${batchInserted}`
    );
  }

  const { count } = await supabase
    .from("aquecedor_message_templates")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  console.log("");
  console.log("Importação concluída.");
  console.log(`Novas nesta execução (aprox.): ${inserted.toLocaleString("pt-BR")}`);
  console.log(`Ignoradas (duplicadas): ${skipped.toLocaleString("pt-BR")}`);
  console.log(`Total ativas no banco agora: ${Number(count || 0).toLocaleString("pt-BR")}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
