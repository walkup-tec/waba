import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveWabaAppLoginUrl } from "./waba-app-url";

export const WELCOME_COVER_FILE_NAME = "compBoasvindasV3.jpg";

/** Caminhos reais no container: JS vive em dist/mail, não no cwd. */
export const listWelcomeCoverFileCandidates = (): string[] => {
  const name = WELCOME_COVER_FILE_NAME;
  return [
    path.join(__dirname, "..", "media", name),
    path.join(__dirname, "..", "..", "media", name),
    path.join(process.cwd(), "media", name),
    path.join(process.cwd(), "dist", "media", name),
  ];
};

export const readWelcomeCoverJpegBase64 = (): string => {
  for (const file of listWelcomeCoverFileCandidates()) {
    if (!existsSync(file)) continue;
    const buf = readFileSync(file);
    if (buf.length < 20_000 || buf.length > 400_000) continue;
    return buf.toString("base64");
  }
  return "";
};

export const resolveWelcomeCoverPublicUrl = (): string => {
  const base = resolveWabaAppLoginUrl().replace(/\/+$/, "");
  return `${base}/media/${WELCOME_COVER_FILE_NAME}`;
};
