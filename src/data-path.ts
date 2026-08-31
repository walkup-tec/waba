import path from "path";
import { WABA_ENV } from "./load-env";

/** Raiz de dados isolada por ambiente (v01/v02 local); produção usa `data/`. */
export function resolveDataDir(): string {
  if (WABA_ENV === "v01" || WABA_ENV === "v02") {
    return path.join(process.cwd(), "data", WABA_ENV);
  }
  return path.join(process.cwd(), "data");
}

export function resolveDataFile(fileName: string): string {
  return path.join(resolveDataDir(), fileName);
}
