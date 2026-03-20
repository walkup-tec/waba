import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const srcPath = path.join(rootDir, "index.html");
const distDir = path.join(rootDir, "dist");
const destPath = path.join(distDir, "index.html");

await fs.promises.mkdir(distDir, { recursive: true });
await fs.promises.copyFile(srcPath, destPath);

console.log(`Copied ${srcPath} -> ${destPath}`);

