const fs = require("fs");
const path = require("path");

let ts;
try {
  ts = require("C:/Users/Usuario/.waba-h-deps/node_modules/typescript");
} catch {
  ts = require("typescript");
}

const srcPath = path.join("src", "monitoring", "uptime-monitor.service.ts");
const outPath = path.join("dist", "monitoring", "uptime-monitor.service.js");
const src = fs.readFileSync(srcPath, "utf8");
const out = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: srcPath,
});

fs.writeFileSync(outPath, out.outputText);
console.log("wrote", outPath, out.outputText.length, "bytes");
for (const needle of ["resolveConfirmFailures", "reconfirmDownResults", "suspeito", "CONFIRM_FAILURES"]) {
  console.log(needle, out.outputText.includes(needle) ? "OK" : "MISSING");
}
