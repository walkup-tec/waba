const fs = require("fs");
const path = require("path");
let ts;
try {
  ts = require("C:/Users/Usuario/.waba-h-deps/node_modules/typescript");
} catch {
  ts = require("typescript");
}
const srcPath = "src/index.ts";
const outPath = "dist/index.js";
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
console.log("wrote", outPath, out.outputText.length);
for (const n of ["is.gd/create.php", "tinyurl.com/api-create", "allowPartialSave", "providersTried"]) {
  console.log(n, out.outputText.includes(n) ? "OK" : "MISSING");
}
