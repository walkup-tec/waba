import fs from "node:fs";

const html = fs.readFileSync("e:/Waba/index.html", "utf8");
const lines = html.split("\n");
const start = lines.findIndex((l) => l.includes('id="tab-disparos-lancamento"'));
const end = lines.findIndex((l) => l.includes('id="tab-disparos"') && l.includes("tab-panel"));
let depth = 0;
for (let i = start; i < end; i++) {
  const line = lines[i];
  const opens = (line.match(/<div\b/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  const before = depth;
  depth += opens - closes;
  if (opens || closes) {
    const mark =
      depth === 0 && i > start
        ? " <-- should be end of tab-disparos-lancamento"
        : depth < 0
          ? " <-- TOO MANY CLOSES"
          : "";
    if (Math.abs(opens - closes) > 0 || mark) {
      console.log(`${i + 1}: ${before} -> ${depth} (+${opens - closes}) ${line.trim().slice(0, 80)}${mark}`);
    }
  }
}
console.log("final depth before tab-disparos:", depth);
