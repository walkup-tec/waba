"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readWelcomeCoverJpegBase64 = exports.WELCOME_COVER_FILE_NAME = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
exports.WELCOME_COVER_FILE_NAME = "compBoasvindasV3.jpg";
const readWelcomeCoverJpegBase64 = () => {
    const candidates = [
        node_path_1.default.join(process.cwd(), "media", exports.WELCOME_COVER_FILE_NAME),
        node_path_1.default.join(process.cwd(), "dist", "media", exports.WELCOME_COVER_FILE_NAME),
    ];
    for (const file of candidates) {
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
