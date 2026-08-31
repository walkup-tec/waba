const fs = require("fs");
const path = require("path");

const src = process.argv[2] || path.join(__dirname, "..", "media", "Aquecimento BD.csv");
const out =
  process.argv[3] || path.join(path.dirname(path.resolve(src)), "Aquecimento-BD-import-supabase.csv");

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

const raw = fs.readFileSync(src, "utf8").replace(/^\uFEFF/, "");
const lines = raw.split(/\r?\n/).filter((line) => line.trim());
const header = parseCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
const messageIndex = header.indexOf("mensagem");
if (messageIndex < 0) {
  console.error('Coluna "mensagem" não encontrada no CSV.');
  process.exit(1);
}

const output = ["message_text,active"];
const seen = new Set();
for (let index = 1; index < lines.length; index += 1) {
  const columns = parseCsvLine(lines[index]);
  const message = String(columns[messageIndex] || "").trim();
  if (!message || seen.has(message)) continue;
  seen.add(message);
  output.push(`"${message.replace(/"/g, '""')}",true`);
}

fs.writeFileSync(out, output.join("\n"), "utf8");
console.log(`Arquivo gerado: ${out}`);
console.log(`Mensagens: ${(output.length - 1).toLocaleString("pt-BR")}`);
