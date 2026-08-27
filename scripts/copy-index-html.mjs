import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const srcPath = path.join(rootDir, "index.html");
const distDir = path.join(rootDir, "dist");
const destPath = path.join(distDir, "index.html");
const mediaSrcDir = path.join(rootDir, "media");
const mediaDistDir = path.join(distDir, "media");

function assertNonEmptyFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} ausente: ${filePath}`);
  }
  const st = fs.statSync(filePath);
  if (!st.isFile() || st.size <= 0) {
    throw new Error(`${label} vazio ou inválido: ${filePath}`);
  }
  return st;
}

async function replaceWithTempCopy(src, dest) {
  assertNonEmptyFile(src, "origem");
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp-copy`;
  await fs.promises.copyFile(src, tmp);
  const tmpStat = await fs.promises.stat(tmp);
  if (tmpStat.size <= 0) {
    await fs.promises.unlink(tmp).catch(() => {});
    throw new Error(`Cópia temporária vazia; recusando substituir ${dest}`);
  }
  try {
    await fs.promises.rename(tmp, dest);
  } catch {
    await fs.promises.copyFile(tmp, dest);
    await fs.promises.unlink(tmp).catch(() => {});
  }
  assertNonEmptyFile(dest, "destino");
}

function fileNeedsCopy(src, dest) {
  if (!fs.existsSync(dest)) return true;
  const a = fs.statSync(src);
  const b = fs.statSync(dest);
  if (a.size !== b.size) return true;
  if (a.mtimeMs > b.mtimeMs + 1000) return true;
  return false;
}

async function syncDirIncremental(srcDir, destDir) {
  let copied = 0;
  let preserved = 0;

  async function walk(rel) {
    const srcHere = rel ? path.join(srcDir, rel) : srcDir;
    const destHere = rel ? path.join(destDir, rel) : destDir;
    await fs.promises.mkdir(destHere, { recursive: true });
    const ents = await fs.promises.readdir(srcHere, { withFileTypes: true });
    for (const ent of ents) {
      const childRel = rel ? path.join(rel, ent.name) : ent.name;
      if (ent.isDirectory()) {
        await walk(childRel);
        continue;
      }
      if (!ent.isFile()) continue;
      const srcFile = path.join(srcDir, childRel);
      const destFile = path.join(destDir, childRel);
      if (fileNeedsCopy(srcFile, destFile)) {
        await replaceWithTempCopy(srcFile, destFile);
        copied += 1;
      } else {
        preserved += 1;
      }
    }
  }

  await walk("");
  return { copied, preserved };
}

assertNonEmptyFile(srcPath, "index.html origem");
await fs.promises.mkdir(distDir, { recursive: true });
await replaceWithTempCopy(srcPath, destPath);
assertNonEmptyFile(srcPath, "index.html origem após cópia");
assertNonEmptyFile(destPath, "dist/index.html");

const swSrc = path.join(rootDir, "media", "sw-deploy-resilience.js");
const swDest = path.join(distDir, "sw-deploy-resilience.js");
if (fs.existsSync(swSrc)) {
  if (fileNeedsCopy(swSrc, swDest)) {
    await replaceWithTempCopy(swSrc, swDest);
  }
}

const faviconIco = path.join(rootDir, "favicon.ico");
if (fs.existsSync(faviconIco)) {
  const favDest = path.join(distDir, "favicon.ico");
  if (fileNeedsCopy(faviconIco, favDest)) {
    await replaceWithTempCopy(faviconIco, favDest);
  }
}

if (fs.existsSync(mediaSrcDir)) {
  const media = await syncDirIncremental(mediaSrcDir, mediaDistDir);
  console.log(
    `media sync copied=${media.copied} preserved=${media.preserved} dest=${mediaDistDir}`,
  );
}

console.log(`Copied ${srcPath} -> ${destPath}`);
