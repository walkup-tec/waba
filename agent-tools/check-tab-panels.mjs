import fs from "fs";

const html = fs.readFileSync("e:/Waba/index.html", "utf8");
const mainStart = html.indexOf('<main id="waba-main"');
const mainEnd = html.indexOf("</main>", mainStart);

const panelIds = [
  "tab-dashboard",
  "tab-disparos",
  "tab-disparos-lancamento",
  "tab-disparos-dashboard",
  "tab-admin-dashboard",
  "tab-admin-assinantes",
  "tab-admin-chamados",
];

for (const id of panelIds) {
  const needle = `id="${id}"`;
  const pos = html.indexOf(needle);
  const inside = pos >= mainStart && pos < mainEnd;
  console.log(`${id}: ${inside ? "INSIDE" : "OUTSIDE"} main (pos=${pos})`);
}
