import { execSync } from "node:child_process";
import fs from "node:fs";

const master = execSync("git show origin/master:index.html", { encoding: "utf8" }).split(/\r?\n/);
const localPath = "index.html";
const local = fs.readFileSync(localPath, "utf8").split(/\r?\n/);

const cssStart = master.findIndex((l) => l.includes(".disparos-pricing-board {"));
const cssEnd = master.findIndex(
  (l, i) => i > cssStart && l.trim() === ".disparos-pricing-lanes {",
);
if (cssStart < 0 || cssEnd < 0) throw new Error("CSS block not found in master");
const cssBlock = master.slice(cssStart, cssEnd);

const localCssStart = local.findIndex((l) => l.includes(".disparos-pricing-board {"));
const localCssEnd = local.findIndex(
  (l, i) => i > localCssStart && l.trim() === ".disparos-pricing-lanes {",
);
if (localCssStart < 0 || localCssEnd < 0) throw new Error("CSS block not found in local");
local.splice(localCssStart, localCssEnd - localCssStart, ...cssBlock);

const mImg = master.findIndex((l) => l.includes("disparos-hex-cluster-art"));
const mSvgStart = master.findIndex(
  (l, i) => i > mImg && l.includes("disparos-hex-light-lines"),
);
let mStageEnd = -1;
for (let i = mSvgStart; i < master.length; i += 1) {
  if (master[i].trim() === "</svg>") {
    mStageEnd = i + 1;
    break;
  }
}
if (mImg < 0 || mSvgStart < 0 || mStageEnd < 0) throw new Error("HTML block not found in master");
const htmlBlock = master.slice(mImg, mStageEnd + 1);

const lImg = local.findIndex((l) => l.includes("disparos-hex-cluster-art"));
if (lImg < 0) throw new Error("HTML img not found in local");
let lEnd = lImg;
while (lEnd < local.length && local[lEnd].trim() !== "</div>") lEnd += 1;
if (lEnd >= local.length) throw new Error("stage closing not found");
local.splice(lImg, lEnd + 1 - lImg, ...htmlBlock);

// Bets-only overlay CSS (after production hex CSS)
const betsCss = `
      body.waba-subscriber-bets-segment .disparos-hex-light-lines {
        display: none !important;
      }
      body.waba-subscriber-bets-segment .disparos-hex-cluster-art {
        mix-blend-mode: normal;
        object-fit: contain;
        object-position: center center;
      }`.trim();

const insertAfter = local.findIndex((l) => l.includes("@media (prefers-reduced-motion: reduce)"));
let insertLine = insertAfter;
while (insertLine < local.length && local[insertLine].trim() !== "}") insertLine += 1;
insertLine += 1;
if (!local.slice(insertLine, insertLine + 5).join("\n").includes("waba-subscriber-bets-segment .disparos-hex-light-lines")) {
  local.splice(insertLine, 0, betsCss);
}

fs.writeFileSync(localPath, local.join("\n"));
console.log("OK", { cssLines: cssBlock.length, htmlLines: htmlBlock.length });
