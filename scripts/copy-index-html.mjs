import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const srcPath = path.join(rootDir, "index.html");
const distDir = path.join(rootDir, "dist");
const destPath = path.join(distDir, "index.html");
const mediaSrcDir = path.join(rootDir, "media");
const mediaDistDir = path.join(distDir, "media");

await fs.promises.mkdir(distDir, { recursive: true });
await fs.promises.copyFile(srcPath, destPath);

const swSrc = path.join(rootDir, "media", "sw-deploy-resilience.js");
const swDest = path.join(distDir, "sw-deploy-resilience.js");
if (fs.existsSync(swSrc)) {
  await fs.promises.copyFile(swSrc, swDest);
}

const faviconIco = path.join(rootDir, "favicon.ico");
if (fs.existsSync(faviconIco)) {
  await fs.promises.copyFile(faviconIco, path.join(distDir, "favicon.ico"));
}

if (fs.existsSync(mediaSrcDir)) {
  await fs.promises.rm(mediaDistDir, { recursive: true, force: true });
  await fs.promises.cp(mediaSrcDir, mediaDistDir, { recursive: true });
}

console.log(`Copied ${srcPath} -> ${destPath}`);

