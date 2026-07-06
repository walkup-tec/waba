import fs from "node:fs";

const html = fs.readFileSync("e:/Waba/index.html", "utf8");
const lines = html.split("\n");
const start = lines.findIndex((l) => l.includes('id="disparos-purchase-home"'));
const end = lines.findIndex((l) => l.includes('id="disparos-credits-hub-panel-history"'));
let depth = 0;
for (let i = start; i < end; i++) {
  const line = lines[i];
  const opens = (line.match(/<div\b/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  const before = depth;
  depth += opens - closes;
  if (i >= 15698 && i <= 15750) {
    console.log(`${i + 1}: ${before} -> ${depth} | ${line.trim().slice(0, 90)}`);
  }
}
console.log("final depth before history:", depth);
