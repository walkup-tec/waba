"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDataDir = resolveDataDir;
exports.resolveDataFile = resolveDataFile;
const path_1 = __importDefault(require("path"));
const load_env_1 = require("./load-env");
/** Raiz de dados isolada por ambiente (v01/v02 local); produção usa `data/`. */
function resolveDataDir() {
    if (load_env_1.WABA_ENV === "v01" || load_env_1.WABA_ENV === "v02") {
        return path_1.default.join(process.cwd(), "data", load_env_1.WABA_ENV);
    }
    return path_1.default.join(process.cwd(), "data");
}
function resolveDataFile(fileName) {
    return path_1.default.join(resolveDataDir(), fileName);
}
