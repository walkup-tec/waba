import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const WELCOME_COVER_FILE_NAME = "compBoasvindasV3.jpg";

export const readWelcomeCoverJpegBase64 = (): string => {
  const candidates = [
    path.join(process.cwd(), "media", WELCOME_COVER_FILE_NAME),
    path.join(process.cwd(), "dist", "media", WELCOME_COVER_FILE_NAME),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const buf = readFileSync(file);
    if (buf.length < 20_000 || buf.length > 400_000) continue;
    return buf.toString("base64");
  }
  return "";
};
