const DEFAULT_ASAAS_API_BASE_URL = "https://api-sandbox.asaas.com/v3";

const resolveAsaasApiBaseUrl = (): string =>
  String(process.env.ASAAS_API_BASE_URL ?? DEFAULT_ASAAS_API_BASE_URL).trim().replace(/\/$/, "");

const resolveAsaasApiKey = (): string => String(process.env.ASAAS_API_KEY ?? "").trim();

export const isAsaasConfigured = (): boolean => resolveAsaasApiKey().length > 0;

type AsaasErrorPayload = {
  errors?: Array<{ description?: string }>;
};

const readAsaasErrorMessage = (payload: unknown, status: number): string => {
  const body = payload as AsaasErrorPayload;
  const description = body.errors?.[0]?.description?.trim();
  if (description) return description;
  return `Falha na integração Asaas (${status}).`;
};

export const asaasRequest = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const apiKey = resolveAsaasApiKey();
  if (!apiKey) {
    throw new Error("Integração Asaas não configurada. Defina ASAAS_API_KEY no servidor.");
  }

  const response = await fetch(`${resolveAsaasApiBaseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(readAsaasErrorMessage(payload, response.status));
  }
  return payload as T;
};

export type AsaasCustomer = {
  id: string;
};

export type AsaasPayment = {
  id: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  status?: string;
  externalReference?: string;
};

export type AsaasPixQrCode = {
  encodedImage?: string;
  payload?: string;
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

export const resolveAsaasPaymentUrl = (payment: { invoiceUrl?: string; bankSlipUrl?: string }): string =>
  String(payment.invoiceUrl ?? payment.bankSlipUrl ?? "").trim();
