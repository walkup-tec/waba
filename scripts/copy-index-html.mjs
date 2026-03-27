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
if (fs.existsSync(mediaSrcDir)) {
  await fs.promises.mkdir(mediaDistDir, { recursive: true });
  await fs.promises.cp(mediaSrcDir, mediaDistDir, { recursive: true });
}

console.log(`Copied ${srcPath} -> ${destPath}`);

