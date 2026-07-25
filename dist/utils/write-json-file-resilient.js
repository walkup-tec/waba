"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeJsonFileResilient = writeJsonFileResilient;
exports.isFsPermissionError = isFsPermissionError;
const fs_1 = require("fs");
const path_1 = require("path");
function isFsPermissionError(err) {
    const code = String((err && err.code) || "");
    return code === "EACCES" || code === "EPERM";
}
async function writeJsonFileResilient(filePath, data) {
    const dir = (0, path_1.dirname)(filePath);
    await fs_1.promises.mkdir(dir, { recursive: true });
    const payload = `${JSON.stringify(data, null, 2)}\n`;
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs_1.promises.writeFile(tmp, payload, "utf-8");
    try {
        await fs_1.promises.rename(tmp, filePath);
        return;
    }
    catch {
        /* tenta caminhos abaixo */
    }
    try {
        await fs_1.promises.writeFile(filePath, payload, "utf-8");
        await fs_1.promises.unlink(tmp).catch(() => undefined);
        return;
    }
    catch (writeErr) {
        if (!isFsPermissionError(writeErr)) {
            await fs_1.promises.unlink(tmp).catch(() => undefined);
            throw writeErr;
        }
        try {
            await fs_1.promises.unlink(filePath);
        }
        catch (unlinkErr) {
            await fs_1.promises.unlink(tmp).catch(() => undefined);
            const wrapped = new Error(`Sem permissão para gravar ${filePath} (ficheiro provavelmente root-owned). ` +
                `Rode chown no volume /app/data para o UID do container (nodejs/1001).`);
            wrapped.cause = writeErr;
            throw wrapped;
        }
        try {
            await fs_1.promises.rename(tmp, filePath);
        }
        catch {
            await fs_1.promises.writeFile(filePath, payload, "utf-8");
            await fs_1.promises.unlink(tmp).catch(() => undefined);
        }
    }
}
