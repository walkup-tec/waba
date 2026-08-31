import fs from "node:fs";

const html = fs.readFileSync("e:/Waba/index.html", "utf8");
const mainStart = html.indexOf('<main id="waba-main"');
const mainEnd = html.indexOf("</main>", mainStart);
const chunk = html.slice(mainStart, mainEnd);

function findPanelAncestors(panelId) {
  const needle = `id="${panelId}"`;
  const pos = chunk.indexOf(needle);
  if (pos < 0) return { panelId, found: false };

  const before = chunk.slice(0, pos);
  const panelOpens = [...before.matchAll(/<div id="(tab-[^"]+)" class="tab-panel/g)];
  const ancestors = [];

  // Walk backwards tracking div depth from pos
  let depth = 0;
  const tokens = [];
  const re = /<(\/?)div\b[^>]*>/g;
  let m;
  while ((m = re.exec(before))) {
    tokens.push({ index: m.index, close: m[1] === "/" });
  }
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t.close) depth++;
    else {
      if (depth > 0) depth--;
      else {
        const lineStart = before.lastIndexOf("\n", t.index);
        const snippet = before.slice(lineStart, t.index + 80);
        const tabMatch = snippet.match(/id="(tab-[^"]+)" class="tab-panel/);
        if (tabMatch) ancestors.unshift(tabMatch[1]);
      }
    }
  }
  return { panelId, found: true, ancestors };
}

for (const id of [
  "tab-dashboard",
  "tab-disparos-dashboard",
  "tab-disparos-lancamento",
  "tab-disparos",
  "tab-admin-dashboard",
  "tab-admin-assinantes",
  "tab-admin-chamados",
]) {
  const r = findPanelAncestors(id);
  console.log(
    r.panelId,
    r.ancestors?.length ? `ancestors: ${r.ancestors.join(" > ")}` : "top-level in main",
  );
}
