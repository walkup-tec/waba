import { parseAsaasDateTimeToIso, stripPixQrEncodedImage } from "./asaas-pix-qr";
import { isValidPixEmvPayload, normalizePixEmvPayload } from "./pix-emv";

const DEFAULT_ASAAS_API_BASE_URL = "https://api-sandbox.asaas.com/v3";
const ASAAS_USER_AGENT = "WABA-Drax/1.0";
const PIX_QR_RETRY_DELAYS_MS = [0, 400, 800, 1600, 2400];

const resolveAsaasApiBaseUrl = (): string =>
  String(process.env.ASAAS_API_BASE_URL ?? DEFAULT_ASAAS_API_BASE_URL).trim().replace(/\/$/, "");

const resolveAsaasApiKey = (): string => String(process.env.ASAAS_API_KEY ?? "").trim();

/** Chave com permissão de saque/transferência PIX (pode ser diferente da cobrança). */
const resolveAsaasTransferApiKey = (): string =>
  String(process.env.ASAAS_TRANSFER_API_KEY ?? process.env.ASAAS_API_KEY ?? "").trim();

export const isAsaasConfigured = (): boolean => resolveAsaasApiKey().length > 0;

export const isAsaasTransferConfigured = (): boolean => resolveAsaasTransferApiKey().length > 0;

export const usesDedicatedAsaasTransferKey = (): boolean =>
  String(process.env.ASAAS_TRANSFER_API_KEY ?? "").trim().length > 0;

type AsaasErrorPayload = {
  errors?: Array<{ code?: string; description?: string }>;
};

const readAsaasErrorMessage = (payload: unknown, status: number): string => {
  const body = payload as AsaasErrorPayload;
  const description = body.errors?.[0]?.description?.trim();
  if (description) return description;
  return `Falha na integração Asaas (${status}).`;
};

const readAsaasErrorCode = (payload: unknown): string =>
  String((payload as AsaasErrorPayload).errors?.[0]?.code ?? "").trim();

export type AsaasTransferPermissionProbe = {
  ok: boolean;
  httpStatus: number;
  code: string;
  message: string;
  usesDedicatedKey: boolean;
};

export type AsaasPaymentApiProbe = {
  ok: boolean;
  httpStatus: number;
  code: string;
  message: string;
};

export const probeAsaasPaymentApi = async (): Promise<AsaasPaymentApiProbe> => {
  if (!isAsaasConfigured()) {
    return {
      ok: false,
      httpStatus: 0,
      code: "missing_key",
      message: "Defina ASAAS_API_KEY no servidor.",
    };
  }

  const response = await fetch(`${resolveAsaasApiBaseUrl()}/finance/balance`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": ASAAS_USER_AGENT,
      access_token: resolveAsaasApiKey(),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  const code = readAsaasErrorCode(payload);
  const message = readAsaasErrorMessage(payload, response.status);

  if (response.ok) {
    return { ok: true, httpStatus: response.status, code: "ok", message: "API de cobrança Asaas acessível." };
  }

  if (response.status === 401 || code === "invalid_access_token") {
    return {
      ok: false,
      httpStatus: response.status,
      code: code || "invalid_access_token",
      message: "ASAAS_API_KEY inválida ou revogada no painel Asaas.",
    };
  }

  if (response.status === 403 && message.toLowerCase().includes("ip")) {
    return {
      ok: false,
      httpStatus: response.status,
      code: code || "ip_forbidden",
      message: `${message} Adicione o IP do servidor na whitelist do Asaas.`,
    };
  }

  return {
    ok: false,
    httpStatus: response.status,
    code: code || "api_error",
    message,
  };
};

export const probeAsaasTransferPermission = async (): Promise<AsaasTransferPermissionProbe> => {
  const usesDedicatedKey = usesDedicatedAsaasTransferKey();
  if (!isAsaasTransferConfigured()) {
    return {
      ok: false,
      httpStatus: 0,
      code: "missing_key",
      message: "Defina ASAAS_TRANSFER_API_KEY (ou ASAAS_API_KEY) com permissão de saque.",
      usesDedicatedKey,
    };
  }

  const response = await fetch(`${resolveAsaasApiBaseUrl()}/transfers`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": ASAAS_USER_AGENT,
      access_token: resolveAsaasTransferApiKey(),
    },
    body: JSON.stringify({
      value: 0.01,
      operationType: "PIX",
      pixAddressKey: "00000000000",
      pixAddressKeyType: "CPF",
      description: "WABA split permission probe",
      externalReference: "waba:split-probe",
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  const code = readAsaasErrorCode(payload);
  const message = readAsaasErrorMessage(payload, response.status);

  if (response.ok) {
    return { ok: true, httpStatus: response.status, code: "ok", message: "Permissão de transferência OK.", usesDedicatedKey };
  }

  if (code === "insufficient_permission") {
    return {
      ok: false,
      httpStatus: response.status,
      code,
      message:
        "A chave Asaas não tem permissão de saque/transferência via API. No painel Asaas → Integrações → Chaves de API, gere uma chave com permissão de transferência e configure ASAAS_TRANSFER_API_KEY.",
      usesDedicatedKey,
    };
  }

  // Qualquer resposta diferente de insufficient_permission indica que a chave pode transferir
  // (ex.: chave PIX inválida, saldo insuficiente, autorização crítica).
  if (response.status === 403 && message.toLowerCase().includes("ip")) {
    return {
      ok: false,
      httpStatus: response.status,
      code: code || "ip_forbidden",
      message: `${message} Adicione o IP do servidor na whitelist do Asaas (Integrações → Mecanismos de segurança).`,
      usesDedicatedKey,
    };
  }

  return {
    ok: true,
    httpStatus: response.status,
    code: code || "reachable",
    message:
      "Chave aceita transferências via API (erro esperado na sonda: " +
      message.slice(0, 120) +
      ").",
    usesDedicatedKey,
  };
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const asaasRequestWithKey = async <T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> => {
  if (!apiKey) {
    throw new Error("Integração Asaas não configurada. Defina ASAAS_API_KEY no servidor.");
  }

  const hasBody = body !== undefined;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": ASAAS_USER_AGENT,
    access_token: apiKey,
  };
  // Asaas GET com body (ou Content-Type em GET) pode responder 403.
  if (hasBody) headers["Content-Type"] = "application/json";

  const response = await fetch(`${resolveAsaasApiBaseUrl()}${path}`, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(readAsaasErrorMessage(payload, response.status));
  }
  return payload as T;
};

export const asaasRequest = async <T>(method: string, path: string, body?: unknown): Promise<T> =>
  asaasRequestWithKey<T>(resolveAsaasApiKey(), method, path, body);

const asaasTransferRequest = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const apiKey = resolveAsaasTransferApiKey();
  if (!apiKey) {
    throw new Error(
      "Repasse PIX indisponível: configure ASAAS_TRANSFER_API_KEY com permissão de saque no Asaas.",
    );
  }
  return asaasRequestWithKey<T>(apiKey, method, path, body);
};

export type AsaasCustomer = {
  id: string;
};

export type AsaasPayment = {
  id: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
  status?: string;
  dueDate?: string;
  externalReference?: string;
};

export type AsaasPixQrCode = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

export type AsaasPixAddressKey = {
  id?: string;
  key?: string;
  type?: string;
  status?: string;
};

type AsaasPixAddressKeyList = {
  data?: AsaasPixAddressKey[];
};

export const createAsaasCustomer = async (input: {
  name: string;
  email: string;
  mobilePhone: string;
  cpfCnpj: string;
  externalReference: string;
}): Promise<AsaasCustomer> => {
  return asaasRequest<AsaasCustomer>("POST", "/customers", {
    name: input.name,
    email: input.email,
    mobilePhone: input.mobilePhone,
    cpfCnpj: input.cpfCnpj,
    externalReference: input.externalReference,
    notificationDisabled: false,
  });
};

export const createAsaasPayment = async (input: {
  customerId: string;
  billingType: "PIX";
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
}): Promise<AsaasPayment> => {
  return asaasRequest<AsaasPayment>("POST", "/payments", {
    customer: input.customerId,
    billingType: input.billingType,
    value: input.value,
    dueDate: input.dueDate,
    description: input.description,
    externalReference: input.externalReference,
  });
};

export const getAsaasPayment = async (paymentId: string): Promise<AsaasPayment> => {
  const normalized = String(paymentId ?? "").trim();
  return asaasRequest<AsaasPayment>("GET", `/payments/${encodeURIComponent(normalized)}`);
};

export const getAsaasPixQrCode = async (paymentId: string): Promise<AsaasPixQrCode> => {
  const normalized = String(paymentId ?? "").trim();
  return asaasRequest<AsaasPixQrCode>(
    "GET",
    `/payments/${encodeURIComponent(normalized)}/pixQrCode`,
  );
};

const normalizeFetchedPixQrCode = (pix: AsaasPixQrCode): AsaasPixQrCode => {
  const payload = normalizePixEmvPayload(String(pix.payload ?? ""));
  return {
    payload,
    encodedImage: stripPixQrEncodedImage(String(pix.encodedImage ?? "")),
    expirationDate: parseAsaasDateTimeToIso(String(pix.expirationDate ?? "")),
  };
};

export const fetchAsaasPaymentPixQrCode = async (paymentId: string): Promise<AsaasPixQrCode> => {
  const normalized = String(paymentId ?? "").trim();
  if (!normalized) {
    throw new Error("Cobrança Asaas sem identificador — não foi possível gerar o QR Code PIX.");
  }

  let lastError = "QR Code PIX ainda não estava pronto no Asaas.";
  for (const delayMs of PIX_QR_RETRY_DELAYS_MS) {
    if (delayMs > 0) await wait(delayMs);
    try {
      const pix = normalizeFetchedPixQrCode(await getAsaasPixQrCode(normalized));
      if (isValidPixEmvPayload(String(pix.payload ?? ""))) {
        return pix;
      }
      lastError = "O Asaas devolveu um copia e cola PIX inválido (CRC/EMV).";
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Falha ao obter QR Code PIX no Asaas.";
    }
  }

  throw new Error(
    `${lastError} Gere um novo QR ou cadastre uma chave Pix ACTIVE no painel Asaas. Bancos como Inter recusam QR parceiro com o código QR124E.`,
  );
};

export const updateAsaasPaymentDueDate = async (paymentId: string, dueDate: string): Promise<AsaasPayment> => {
  const normalized = String(paymentId ?? "").trim();
  return asaasRequest<AsaasPayment>("PUT", `/payments/${encodeURIComponent(normalized)}`, {
    dueDate,
  });
};

export const listActiveAsaasPixAddressKeys = async (): Promise<AsaasPixAddressKey[]> => {
  const response = await asaasRequest<AsaasPixAddressKeyList>(
    "GET",
    "/pix/addressKeys?status=ACTIVE&limit=100&offset=0",
  );
  return Array.isArray(response.data) ? response.data : [];
};

export const probeAsaasPixAddressKeys = async (): Promise<{
  ok: boolean;
  hasActiveKey: boolean;
  message: string;
}> => {
  try {
    const keys = await listActiveAsaasPixAddressKeys();
    const hasActiveKey = keys.some((key) => String(key.status ?? "").toUpperCase() === "ACTIVE");
    return {
      ok: true,
      hasActiveKey,
      message: hasActiveKey
        ? "Chave Pix ACTIVE encontrada na conta Asaas."
        : "Nenhuma chave Pix ACTIVE na conta Asaas.",
    };
  } catch (error) {
    return {
      ok: false,
      hasActiveKey: false,
      message: error instanceof Error ? error.message : "Falha ao listar chaves Pix no Asaas.",
    };
  }
};

export const resolveAsaasPaymentUrl = (payment: { invoiceUrl?: string; bankSlipUrl?: string }): string =>
  String(payment.invoiceUrl ?? payment.bankSlipUrl ?? "").trim();

export type AsaasTransfer = {
  id: string;
  status?: string;
  value?: number;
  failReason?: string;
  transactionReceiptUrl?: string;
  externalReference?: string;
};

export type AsaasTransferList = {
  data?: AsaasTransfer[];
  totalCount?: number;
};

export const listAsaasTransfers = async (input?: {
  externalReference?: string;
  offset?: number;
  limit?: number;
}): Promise<AsaasTransferList> => {
  const params = new URLSearchParams();
  const externalReference = String(input?.externalReference ?? "").trim();
  if (externalReference) params.set("externalReference", externalReference);
  const offset = Math.max(0, Math.round(Number(input?.offset ?? 0)));
  const limit = Math.max(1, Math.min(100, Math.round(Number(input?.limit ?? 20))));
  params.set("offset", String(offset));
  params.set("limit", String(limit));
  const query = params.toString();
  return asaasTransferRequest<AsaasTransferList>("GET", `/transfers${query ? `?${query}` : ""}`);
};

export const createAsaasPixTransfer = async (input: {
  value: number;
  pixAddressKey: string;
  pixAddressKeyType: string;
  description: string;
  externalReference: string;
}): Promise<AsaasTransfer> => {
  return asaasTransferRequest<AsaasTransfer>("POST", "/transfers", {
    value: input.value,
    operationType: "PIX",
    pixAddressKey: input.pixAddressKey,
    pixAddressKeyType: input.pixAddressKeyType,
    description: input.description,
    externalReference: input.externalReference,
  });
};

export const getAsaasTransfer = async (transferId: string): Promise<AsaasTransfer> => {
  const normalized = String(transferId ?? "").trim();
  return asaasTransferRequest<AsaasTransfer>("GET", `/transfers/${encodeURIComponent(normalized)}`);
};
