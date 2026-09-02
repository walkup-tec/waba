import { createHash } from "node:crypto";
import { WabaSubscriberRepository } from "../../subscribers/waba-subscriber.repository";
import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { WABA_LABORATORIO_OWNER_EMAIL } from "../../menus/waba-laboratorio-access";
import { isMenuAllowedForUser } from "../../menus/waba-menu-permissions.service";
import { WABA_TECH_PROVIDER_MENU_IDS } from "../../menus/waba-menu-registry";
import { WabaSystemUserService } from "../../users/waba-system-user.service";
import type { MetaWhatsappTenant } from "./meta-whatsapp-connection.types";

const normalizeEmail = (value: string): string => String(value || "").trim().toLowerCase();

/** Namespace DNS RFC 4122 — UUID v5 estável para staff sem registro de assinante. */
const META_TENANT_NAMESPACE = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");

function uuidV5FromEmail(email: string): string {
  const hash = createHash("sha1").update(META_TENANT_NAMESPACE).update(`waba-meta-tenant:${email}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export type MetaWhatsappTenantOptions = {
  /** Testes: força se o staff compartilha o workspace do Laboratório. */
  hasLaboratorioMenu?: boolean;
};

function staffHasLaboratorioMenu(auth: WabaRequestAuth): boolean {
  if (auth.role !== "operacional" && auth.role !== "suporte") return false;
  const user = new WabaSystemUserService().getByEmail(auth.email);
  if (!user) return false;
  return WABA_TECH_PROVIDER_MENU_IDS.some((id) => isMenuAllowedForUser(user, id));
}

function tenantForWorkspaceEmail(
  workspaceEmail: string,
  subscriberRepository: Pick<WabaSubscriberRepository, "getByEmail">,
): MetaWhatsappTenant {
  const subscriber = subscriberRepository.getByEmail(workspaceEmail);
  if (subscriber?.id) {
    return { tenantId: subscriber.id, ownerEmail: subscriber.email };
  }
  return { tenantId: uuidV5FromEmail(workspaceEmail), ownerEmail: workspaceEmail };
}

/**
 * Assinante e master usam o tenant do próprio e-mail.
 * Operacional/suporte com menu do Laboratório lê o mesmo workspace do dono (Mozart).
 */
export function resolveMetaWhatsappTenant(
  auth: WabaRequestAuth,
  subscriberRepository: Pick<WabaSubscriberRepository, "getByEmail"> = new WabaSubscriberRepository(),
  options: MetaWhatsappTenantOptions = {},
): MetaWhatsappTenant {
  const sessionEmail = normalizeEmail(auth.email);
  if (!sessionEmail || !sessionEmail.includes("@") || auth.role === "guest") {
    throw new Error("Sessão inválida para integração Meta.");
  }

  const shareLab =
    (auth.role === "operacional" || auth.role === "suporte") &&
    (options.hasLaboratorioMenu ?? staffHasLaboratorioMenu(auth));
  const workspaceEmail = shareLab ? WABA_LABORATORIO_OWNER_EMAIL : sessionEmail;
  return tenantForWorkspaceEmail(workspaceEmail, subscriberRepository);
}

export { uuidV5FromEmail as deriveStableMetaTenantId };
