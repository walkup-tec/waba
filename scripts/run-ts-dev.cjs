/**
 * Dev server no workspace H: (sem node_modules local).
 * Preferência: dist/index.js (npm run build:h). Fallback: ts-node transpile-only.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const depsRoot = path.join(process.env.USERPROFILE || "", ".waba-h-deps", "node_modules");
const localDeps = path.join(repoRoot, "node_modules");

const isUsableNodeModules = (dir) => {
  const dotenvPkg = path.join(dir, "dotenv", "package.json");
  if (!fs.existsSync(dotenvPkg)) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(dotenvPkg, "utf8"));
    return Boolean(parsed && typeof parsed === "object" && parsed.name);
  } catch {
    return false;
  }
};

const nodeModules = isUsableNodeModules(localDeps)
  ? localDeps
  : isUsableNodeModules(depsRoot)
    ? depsRoot
    : depsRoot;

const env = {
  ...process.env,
  NODE_PATH: nodeModules,
};

const distIndex = path.join(repoRoot, "dist", "index.js");
if (fs.existsSync(distIndex)) {
  const result = spawnSync(process.execPath, [distIndex], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

const tsNodeBin = path.join(nodeModules, "ts-node", "dist", "bin.js");
if (!fs.existsSync(tsNodeBin)) {
  console.error("[run-ts-dev] dist/index.js ausente e ts-node não encontrado. Rode: npm run build:h");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [tsNodeBin, "--transpile-only", path.join(repoRoot, "src", "index.ts")],
  { cwd: repoRoot, env, stdio: "inherit" },
);
process.exit(result.status ?? 1);
