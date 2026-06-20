"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAsaasTransfer = exports.createAsaasPixTransfer = exports.resolveAsaasPaymentUrl = exports.getAsaasPixQrCode = exports.getAsaasPayment = exports.createAsaasPayment = exports.createAsaasCustomer = exports.asaasRequest = exports.probeAsaasTransferPermission = exports.usesDedicatedAsaasTransferKey = exports.isAsaasTransferConfigured = exports.isAsaasConfigured = void 0;
const DEFAULT_ASAAS_API_BASE_URL = "https://api-sandbox.asaas.com/v3";
const resolveAsaasApiBaseUrl = () => String(process.env.ASAAS_API_BASE_URL ?? DEFAULT_ASAAS_API_BASE_URL).trim().replace(/\/$/, "");
const resolveAsaasApiKey = () => String(process.env.ASAAS_API_KEY ?? "").trim();
/** Chave com permissão de saque/transferência PIX (pode ser diferente da cobrança). */
const resolveAsaasTransferApiKey = () => String(process.env.ASAAS_TRANSFER_API_KEY ?? process.env.ASAAS_API_KEY ?? "").trim();
const isAsaasConfigured = () => resolveAsaasApiKey().length > 0;
exports.isAsaasConfigured = isAsaasConfigured;
const isAsaasTransferConfigured = () => resolveAsaasTransferApiKey().length > 0;
exports.isAsaasTransferConfigured = isAsaasTransferConfigured;
const usesDedicatedAsaasTransferKey = () => String(process.env.ASAAS_TRANSFER_API_KEY ?? "").trim().length > 0;
exports.usesDedicatedAsaasTransferKey = usesDedicatedAsaasTransferKey;
const readAsaasErrorMessage = (payload, status) => {
    const body = payload;
    const description = body.errors?.[0]?.description?.trim();
    if (description)
        return description;
    return `Falha na integração Asaas (${status}).`;
};
const readAsaasErrorCode = (payload) => String(payload.errors?.[0]?.code ?? "").trim();
const probeAsaasTransferPermission = async () => {
    const usesDedicatedKey = (0, exports.usesDedicatedAsaasTransferKey)();
    if (!(0, exports.isAsaasTransferConfigured)()) {
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
            "Content-Type": "application/json",
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
    const payload = (await response.json().catch(() => ({})));
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
            message: "A chave Asaas não tem permissão de saque/transferência via API. No painel Asaas → Integrações → Chaves de API, gere uma chave com permissão de transferência e configure ASAAS_TRANSFER_API_KEY.",
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
        message: "Chave aceita transferências via API (erro esperado na sonda: " +
            message.slice(0, 120) +
            ").",
        usesDedicatedKey,
    };
};
exports.probeAsaasTransferPermission = probeAsaasTransferPermission;
const asaasRequestWithKey = async (apiKey, method, path, body) => {
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
const asaasRequest = async (method, path, body) => asaasRequestWithKey(resolveAsaasApiKey(), method, path, body);
exports.asaasRequest = asaasRequest;
const asaasTransferRequest = async (method, path, body) => {
    const apiKey = resolveAsaasTransferApiKey();
    if (!apiKey) {
        throw new Error("Repasse PIX indisponível: configure ASAAS_TRANSFER_API_KEY com permissão de saque no Asaas.");
    }
    return asaasRequestWithKey(apiKey, method, path, body);
};
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
const createAsaasPixTransfer = async (input) => {
    return asaasTransferRequest("POST", "/transfers", {
        value: input.value,
        operationType: "PIX",
        pixAddressKey: input.pixAddressKey,
        pixAddressKeyType: input.pixAddressKeyType,
        description: input.description,
        externalReference: input.externalReference,
    });
};
exports.createAsaasPixTransfer = createAsaasPixTransfer;
const getAsaasTransfer = async (transferId) => {
    const normalized = String(transferId ?? "").trim();
    return asaasTransferRequest("GET", `/transfers/${encodeURIComponent(normalized)}`);
};
exports.getAsaasTransfer = getAsaasTransfer;
