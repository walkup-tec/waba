"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timingSafeEqualString = timingSafeEqualString;
exports.readHubSignature256 = readHubSignature256;
exports.computeMetaHubSignatureHex = computeMetaHubSignatureHex;
exports.isValidMetaHubSignature = isValidMetaHubSignature;
const node_crypto_1 = require("node:crypto");
function timingSafeEqualString(left, right) {
    const a = Buffer.from(String(left || ""), "utf8");
    const b = Buffer.from(String(right || ""), "utf8");
    if (a.length !== b.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(a, b);
}
function readHubSignature256(header) {
    const raw = String(header || "").trim();
    if (!raw)
        return null;
    const match = /^sha256=([0-9a-f]{64})$/i.exec(raw);
    return match ? match[1].toLowerCase() : null;
}
function computeMetaHubSignatureHex(appSecret, rawBody) {
    return (0, node_crypto_1.createHmac)("sha256", appSecret).update(rawBody).digest("hex");
}
function isValidMetaHubSignature(input) {
    const secret = String(input.appSecret || "");
    if (!secret || !input.rawBody || !Buffer.isBuffer(input.rawBody))
        return false;
    const received = readHubSignature256(input.header);
    if (!received)
        return false;
    const expected = computeMetaHubSignatureHex(secret, input.rawBody);
    return timingSafeEqualString(expected, received);
}
