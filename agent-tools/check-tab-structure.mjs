import fs from "node:fs";

const html = fs.readFileSync("e:/Waba/index.html", "utf8");
const mainStart = html.indexOf('<main id="waba-main"');
const mainEnd = html.indexOf("</main>", mainStart);
const mainChunk = html.slice(mainStart, mainEnd);

const panelIds = [...mainChunk.matchAll(/id="(tab-[^"]+)"/g)].map((m) => m[1]);
const directIds = [
  ...mainChunk.matchAll(/<div id="(tab-[^"]+)" class="tab-panel/g),
].map((m) => m[1]);

console.log("panels in main:", panelIds.length);
console.log("direct child tab-panels:", directIds.length);
const notDirect = [...new Set(panelIds)].filter((p) => !directIds.includes(p));
console.log("NOT direct children:", notDirect);

// depth check: parse roughly by tracking open divs after main
const afterMain = html.slice(mainStart);
let depth = 0;
const panelDepth = {};
for (const line of afterMain.split("\n")) {
  const opens = (line.match(/<div\b/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  const idMatch = line.match(/id="(tab-[^"]+)"/);
  if (idMatch && line.includes("tab-panel")) {
    panelDepth[idMatch[1]] = depth;
  }
  depth += opens - closes;
  if (line.includes("</main>")) break;
}
console.log("\nPanel nesting depth (0 = direct child of main):");
for (const [id, d] of Object.entries(panelDepth).sort((a, b) => a[1] - b[1])) {
  console.log(`  depth ${d}: ${id}`);
}
