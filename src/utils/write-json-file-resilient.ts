import { promises as fs } from "fs";
import path from "path";

export function isFsPermissionError(err: unknown): boolean {
  const code = String((err as NodeJS.ErrnoException)?.code || "");
  return code === "EACCES" || code === "EPERM";
}

/**
 * Escrita resiliente para volumes Docker onde um ficheiro pode ficar root-owned
 * (ex.: após `docker cp` no purge) enquanto o diretório continua gravável pelo UID do app.
 * Ordem: tmp → rename → write direto → unlink+replace.
 */
export async function writeJsonFileResilient(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  await fs.writeFile(tmp, payload, "utf-8");

  try {
    await fs.rename(tmp, filePath);
    return;
  } catch {
    /* tenta caminhos abaixo */
  }

  try {
    await fs.writeFile(filePath, payload, "utf-8");
    await fs.unlink(tmp).catch(() => undefined);
    return;
  } catch (writeErr) {
    if (!isFsPermissionError(writeErr)) {
      await fs.unlink(tmp).catch(() => undefined);
      throw writeErr;
    }

    try {
      await fs.unlink(filePath);
    } catch (unlinkErr) {
      await fs.unlink(tmp).catch(() => undefined);
      const wrapped = new Error(
        `Sem permissão para gravar ${filePath} (ficheiro provavelmente root-owned). ` +
          `Rode chown no volume /app/data para o UID do container (nodejs/1001).`,
      );
      (wrapped as Error & { cause?: unknown }).cause = writeErr;
      throw wrapped;
    }

    try {
      await fs.rename(tmp, filePath);
    } catch {
      await fs.writeFile(filePath, payload, "utf-8");
      await fs.unlink(tmp).catch(() => undefined);
    }
  }
}
