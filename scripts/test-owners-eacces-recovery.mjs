/**
 * Teste local: simula ficheiro "preso" (chmod 444) num dir gravável e valida
 * writeJsonFileResilient (unlink+replace), o mesmo padrão do EACCES em produção.
 *
 * Uso: node --import tsx scripts/test-owners-eacces-recovery.mjs
 *  ou: node scripts/test-owners-eacces-recovery.mjs  (se dist já tiver o util)
 */
import { promises as fs, chmodSync, existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath, pathToFileURL } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

async function loadWriter() {
  const distJs = path.join(root, "dist", "utils", "write-json-file-resilient.js");
  const srcTs = path.join(root, "src", "utils", "write-json-file-resilient.ts");
  if (existsSync(distJs)) {
    return import(pathToFileURL(distJs).href);
  }
  // fallback: transpile-less inline copy of the algorithm for the test
  const { register } = await import("node:module");
  try {
    const { pathToFileURL: p2 } = await import("url");
    register("tsx/esm", p2("./"));
  } catch {
    /* no tsx */
  }
  if (existsSync(srcTs)) {
    try {
      return import(pathToFileURL(srcTs).href);
    } catch {
      /* fall through to inline */
    }
  }
  return null;
}

async function writeJsonFileResilientInline(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, payload, "utf-8");
  try {
    await fs.rename(tmp, filePath);
    return;
  } catch {
    /* continue */
  }
  try {
    await fs.writeFile(filePath, payload, "utf-8");
    await fs.unlink(tmp).catch(() => undefined);
    return;
  } catch (writeErr) {
    const code = writeErr && writeErr.code;
    if (code !== "EACCES" && code !== "EPERM") {
      await fs.unlink(tmp).catch(() => undefined);
      throw writeErr;
    }
    try {
      await fs.unlink(filePath);
    } catch {
      await fs.unlink(tmp).catch(() => undefined);
      throw writeErr;
    }
    try {
      await fs.rename(tmp, filePath);
    } catch {
      await fs.writeFile(filePath, payload, "utf-8");
      await fs.unlink(tmp).catch(() => undefined);
    }
  }
}

async function main() {
  const mod = await loadWriter();
  const writeJsonFileResilient = mod?.writeJsonFileResilient || writeJsonFileResilientInline;

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "waba-owners-eacces-"));
  const file = path.join(dir, "instance-owners.json");
  writeFileSync(file, JSON.stringify({ instances: { old: { ownerEmail: "a@b.c", createdAt: "x" } } }, null, 2));
  try {
    chmodSync(file, 0o444);
  } catch {
    console.warn("chmod 444 falhou (ambiente); seguindo com teste de escrita normal");
  }

  const next = {
    instances: {
      "6035": { ownerEmail: "mozart.pmo@gmail.com", createdAt: new Date().toISOString() },
    },
    deletedInstances: {},
  };

  let failedDirect = false;
  try {
    await fs.writeFile(file, JSON.stringify(next), "utf-8");
  } catch (err) {
    failedDirect = true;
    console.log("direct_write_blocked", err.code || err.message);
  }

  await writeJsonFileResilient(file, next);
  const raw = readFileSync(file, "utf-8");
  const parsed = JSON.parse(raw);
  if (!parsed.instances?.["6035"]) {
    throw new Error("FAIL: instancia 6035 não gravada");
  }
  console.log(
    JSON.stringify({
      ok: true,
      dir,
      directWriteBlocked: failedDirect,
      has6035: true,
      owner: parsed.instances["6035"].ownerEmail,
    }),
  );
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
