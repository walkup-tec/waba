"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMetaWhatsappTenant = resolveMetaWhatsappTenant;
exports.deriveStableMetaTenantId = uuidV5FromEmail;
const node_crypto_1 = require("node:crypto");
const waba_subscriber_repository_1 = require("../../subscribers/waba-subscriber.repository");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
/** Namespace DNS RFC 4122 — UUID v5 estável para staff sem registro de assinante. */
const META_TENANT_NAMESPACE = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");
function uuidV5FromEmail(email) {
    const hash = (0, node_crypto_1.createHash)("sha1").update(META_TENANT_NAMESPACE).update(`waba-meta-tenant:${email}`).digest();
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = hash.subarray(0, 16).toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
function resolveMetaWhatsappTenant(auth, subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository()) {
    const ownerEmail = normalizeEmail(auth.email);
    if (!ownerEmail || !ownerEmail.includes("@") || auth.role === "guest") {
        throw new Error("Sessão inválida para integração Meta.");
    }
    const subscriber = subscriberRepository.getByEmail(ownerEmail);
    if (subscriber?.id) {
        return { tenantId: subscriber.id, ownerEmail: subscriber.email };
    }
    return { tenantId: uuidV5FromEmail(ownerEmail), ownerEmail };
}
