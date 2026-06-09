"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAsaasPaymentUrl = exports.getAsaasPixQrCode = exports.getAsaasPayment = exports.createAsaasPayment = exports.createAsaasCustomer = exports.asaasRequest = exports.isAsaasConfigured = void 0;
const DEFAULT_ASAAS_API_BASE_URL = "https://api-sandbox.asaas.com/v3";
const resolveAsaasApiBaseUrl = () => String(process.env.ASAAS_API_BASE_URL ?? DEFAULT_ASAAS_API_BASE_URL).trim().replace(/\/$/, "");
const resolveAsaasApiKey = () => String(process.env.ASAAS_API_KEY ?? "").trim();
const isAsaasConfigured = () => resolveAsaasApiKey().length > 0;
exports.isAsaasConfigured = isAsaasConfigured;
const readAsaasErrorMessage = (payload, status) => {
    const body = payload;
    const description = body.errors?.[0]?.description?.trim();
    if (description)
        return description;
    return `Falha na integração Asaas (${status}).`;
};
const asaasRequest = async (method, path, body) => {
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
    const payload = (await response.json().catch(() => ({})));
    if (!response.ok) {
        throw new Error(readAsaasErrorMessage(payload, response.status));
    }
    return payload;
};
exports.asaasRequest = asaasRequest;
const createAsaasCustomer = async (input) => {
    return (0, exports.asaasRequest)("POST", "/customers", {
        name: input.name,
        email: input.email,
        mobilePhone: input.mobilePhone,
        cpfCnpj: input.cpfCnpj,
        externalReference: input.externalReference,
        notificationDisabled: false,
    });
};
exports.createAsaasCustomer = createAsaasCustomer;
const createAsaasPayment = async (input) => {
    return (0, exports.asaasRequest)("POST", "/payments", {
        customer: input.customerId,
        billingType: input.billingType,
        value: input.value,
        dueDate: input.dueDate,
        description: input.description,
        externalReference: input.externalReference,
    });
};
exports.createAsaasPayment = createAsaasPayment;
const getAsaasPayment = async (paymentId) => {
    const normalized = String(paymentId ?? "").trim();
    return (0, exports.asaasRequest)("GET", `/payments/${encodeURIComponent(normalized)}`);
};
exports.getAsaasPayment = getAsaasPayment;
const getAsaasPixQrCode = async (paymentId) => {
    const normalized = String(paymentId ?? "").trim();
    return (0, exports.asaasRequest)("GET", `/payments/${encodeURIComponent(normalized)}/pixQrCode`);
};
exports.getAsaasPixQrCode = getAsaasPixQrCode;
const resolveAsaasPaymentUrl = (payment) => String(payment.invoiceUrl ?? payment.bankSlipUrl ?? "").trim();
exports.resolveAsaasPaymentUrl = resolveAsaasPaymentUrl;
