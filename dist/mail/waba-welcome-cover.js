"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveWelcomeCoverPublicUrl = exports.readWelcomeCoverJpegBase64 = exports.listWelcomeCoverFileCandidates = exports.WELCOME_COVER_FILE_NAME = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const waba_app_url_1 = require("./waba-app-url");
exports.WELCOME_COVER_FILE_NAME = "compBoasvindasV3.jpg";
/** Caminhos reais no container: JS vive em dist/mail, não no cwd. */
const listWelcomeCoverFileCandidates = () => {
    const name = exports.WELCOME_COVER_FILE_NAME;
    return [
        node_path_1.default.join(__dirname, "..", "media", name),
        node_path_1.default.join(__dirname, "..", "..", "media", name),
        node_path_1.default.join(process.cwd(), "media", name),
        node_path_1.default.join(process.cwd(), "dist", "media", name),
    ];
};
exports.listWelcomeCoverFileCandidates = listWelcomeCoverFileCandidates;
const readWelcomeCoverJpegBase64 = () => {
    for (const file of (0, exports.listWelcomeCoverFileCandidates)()) {
        if (!(0, node_fs_1.existsSync)(file))
            continue;
        const buf = (0, node_fs_1.readFileSync)(file);
        if (buf.length < 20000 || buf.length > 400000)
            continue;
        return buf.toString("base64");
    }
    return "";
};
exports.readWelcomeCoverJpegBase64 = readWelcomeCoverJpegBase64;
const resolveWelcomeCoverPublicUrl = () => {
    const base = (0, waba_app_url_1.resolveWabaAppLoginUrl)().replace(/\/+$/, "");
    return `${base}/media/${exports.WELCOME_COVER_FILE_NAME}`;
};
exports.resolveWelcomeCoverPublicUrl = resolveWelcomeCoverPublicUrl;
