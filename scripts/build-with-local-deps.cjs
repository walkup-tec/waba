/**
 * Build WABA com node_modules em disco NTFS local (Google Drive H: não suporta npm install).
 * Deps: %USERPROFILE%\.waba-h-deps\node_modules
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const depsRoot = path.join(process.env.USERPROFILE || "", ".waba-h-deps");
const depsNodeModules = path.join(depsRoot, "node_modules");

function syncPackageManifests() {
  fs.mkdirSync(depsRoot, { recursive: true });
  for (const file of ["package.json", "package-lock.json"]) {
    const src = path.join(repoRoot, file);
    const dest = path.join(depsRoot, file);
    if (!fs.existsSync(src)) {
      throw new Error(`Arquivo ausente: ${src}`);
    }
    fs.copyFileSync(src, dest);
  }
}

function ensureDeps() {
  syncPackageManifests();
  const stampSrc = path.join(repoRoot, "package-lock.json");
  const stampDest = path.join(depsRoot, ".lock-stamp");
  const lockHash = fs.readFileSync(stampSrc, "utf8");
  const prev = fs.existsSync(stampDest) ? fs.readFileSync(stampDest, "utf8") : "";
  const hasModules = fs.existsSync(path.join(depsNodeModules, "typescript", "package.json"));

  if (prev !== lockHash || !hasModules) {
    console.log("[build-h-deps] npm ci em", depsRoot);
    execSync("npm ci", {
      cwd: depsRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        npm_config_cache: path.join(process.env.USERPROFILE || "", "npm-cache"),
        npm_config_fund: "false",
        npm_config_audit: "false",
      },
    });
    fs.writeFileSync(stampDest, lockHash, "utf8");
  } else {
    console.log("[build-h-deps] deps OK (cache local)");
  }
}

function runTsc() {
  const tscBin = path.join(depsNodeModules, "typescript", "bin", "tsc");
  if (!fs.existsSync(tscBin)) {
    throw new Error("typescript não encontrado em .waba-h-deps — rode npm ci.");
  }

  const depsPosix = depsNodeModules.replace(/\\/g, "/");
  const tsconfigBuild = {
    extends: "./tsconfig.json",
    compilerOptions: {
      baseUrl: ".",
      paths: {
        "*": [`${depsPosix}/*`],
      },
      typeRoots: [`${depsPosix}/@types`],
    },
  };
  const tsconfigPath = path.join(repoRoot, "tsconfig.build.local.json");
  fs.writeFileSync(tsconfigPath, `${JSON.stringify(tsconfigBuild, null, 2)}\n`, "utf8");

  execSync(`node "${tscBin}" -p "${tsconfigPath}"`, {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

function runNodeScript(relPath) {
  execSync(`node "${path.join(repoRoot, relPath)}"`, {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_PATH: depsNodeModules,
    },
  });
}

ensureDeps();
runNodeScript("scripts/generate-brand-logo-module.mjs");
runTsc();
runNodeScript("scripts/copy-index-html.mjs");
console.log("[build-h-deps] build concluído");
