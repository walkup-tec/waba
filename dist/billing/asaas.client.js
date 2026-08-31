"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAsaasTransfer = exports.createAsaasPixTransfer = exports.listAsaasTransfers = exports.resolveAsaasPaymentUrl = exports.probeAsaasPixAddressKeys = exports.listActiveAsaasPixAddressKeys = exports.updateAsaasPaymentDueDate = exports.fetchAsaasPaymentPixQrCode = exports.getAsaasPixQrCode = exports.getAsaasPayment = exports.createAsaasPayment = exports.createAsaasCustomer = exports.asaasRequest = exports.probeAsaasTransferPermission = exports.probeAsaasPaymentApi = exports.usesDedicatedAsaasTransferKey = exports.isAsaasTransferConfigured = exports.isAsaasConfigured = void 0;
const asaas_pix_qr_1 = require("./asaas-pix-qr");
const pix_emv_1 = require("./pix-emv");
const DEFAULT_ASAAS_API_BASE_URL = "https://api-sandbox.asaas.com/v3";
const ASAAS_USER_AGENT = "WABA-Drax/1.0";
const PIX_QR_RETRY_DELAYS_MS = [0, 400, 800, 1600, 2400];
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
const probeAsaasPaymentApi = async () => {
    if (!(0, exports.isAsaasConfigured)()) {
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
    const payload = (await response.json().catch(() => ({})));
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
exports.probeAsaasPaymentApi = probeAsaasPaymentApi;
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
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const asaasRequestWithKey = async (apiKey, method, path, body) => {
    if (!apiKey) {
        throw new Error("Integração Asaas não configurada. Defina ASAAS_API_KEY no servidor.");
    }
    const hasBody = body !== undefined;
    const headers = {
        Accept: "application/json",
        "User-Agent": ASAAS_USER_AGENT,
        access_token: apiKey,
    };
    // Asaas GET com body (ou Content-Type em GET) pode responder 403.
    if (hasBody)
        headers["Content-Type"] = "application/json";
    const response = await fetch(`${resolveAsaasApiBaseUrl()}${path}`, {
        method,
        headers,
        body: hasBody ? JSON.stringify(body) : undefined,
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
const normalizeFetchedPixQrCode = (pix) => {
    const payload = (0, pix_emv_1.normalizePixEmvPayload)(String(pix.payload ?? ""));
    return {
        payload,
        encodedImage: (0, asaas_pix_qr_1.stripPixQrEncodedImage)(String(pix.encodedImage ?? "")),
        expirationDate: (0, asaas_pix_qr_1.parseAsaasDateTimeToIso)(String(pix.expirationDate ?? "")),
    };
};
const fetchAsaasPaymentPixQrCode = async (paymentId) => {
    const normalized = String(paymentId ?? "").trim();
    if (!normalized) {
        throw new Error("Cobrança Asaas sem identificador — não foi possível gerar o QR Code PIX.");
    }
    let lastError = "QR Code PIX ainda não estava pronto no Asaas.";
    for (const delayMs of PIX_QR_RETRY_DELAYS_MS) {
        if (delayMs > 0)
            await wait(delayMs);
        try {
            const pix = normalizeFetchedPixQrCode(await (0, exports.getAsaasPixQrCode)(normalized));
            if ((0, pix_emv_1.looksLikePixEmvPayload)(String(pix.payload ?? ""))) {
                return pix;
            }
            lastError = "O Asaas ainda não devolveu um copia e cola PIX utilizável.";
        }
        catch (error) {
            lastError = error instanceof Error ? error.message : "Falha ao obter QR Code PIX no Asaas.";
        }
    }
    throw new Error(`${lastError} Tente Gerar PIX de novo. Se persistir, abra a fatura Asaas ou cadastre uma chave Pix ACTIVE no painel.`);
};
exports.fetchAsaasPaymentPixQrCode = fetchAsaasPaymentPixQrCode;
const updateAsaasPaymentDueDate = async (paymentId, dueDate) => {
    const normalized = String(paymentId ?? "").trim();
    return (0, exports.asaasRequest)("PUT", `/payments/${encodeURIComponent(normalized)}`, {
        dueDate,
    });
};
exports.updateAsaasPaymentDueDate = updateAsaasPaymentDueDate;
const listActiveAsaasPixAddressKeys = async () => {
    const response = await (0, exports.asaasRequest)("GET", "/pix/addressKeys?status=ACTIVE&limit=100&offset=0");
    return Array.isArray(response.data) ? response.data : [];
};
exports.listActiveAsaasPixAddressKeys = listActiveAsaasPixAddressKeys;
const probeAsaasPixAddressKeys = async () => {
    try {
        const keys = await (0, exports.listActiveAsaasPixAddressKeys)();
        const hasActiveKey = keys.some((key) => String(key.status ?? "").toUpperCase() === "ACTIVE");
        return {
            ok: true,
            hasActiveKey,
            message: hasActiveKey
                ? "Chave Pix ACTIVE encontrada na conta Asaas."
                : "Nenhuma chave Pix ACTIVE na conta Asaas.",
        };
    }
    catch (error) {
        return {
            ok: false,
            hasActiveKey: false,
            message: error instanceof Error ? error.message : "Falha ao listar chaves Pix no Asaas.",
        };
    }
};
exports.probeAsaasPixAddressKeys = probeAsaasPixAddressKeys;
const resolveAsaasPaymentUrl = (payment) => String(payment.invoiceUrl ?? payment.bankSlipUrl ?? "").trim();
exports.resolveAsaasPaymentUrl = resolveAsaasPaymentUrl;
const listAsaasTransfers = async (input) => {
    const params = new URLSearchParams();
    const externalReference = String(input?.externalReference ?? "").trim();
    if (externalReference)
        params.set("externalReference", externalReference);
    const offset = Math.max(0, Math.round(Number(input?.offset ?? 0)));
    const limit = Math.max(1, Math.min(100, Math.round(Number(input?.limit ?? 20))));
    params.set("offset", String(offset));
    params.set("limit", String(limit));
    const query = params.toString();
    return asaasTransferRequest("GET", `/transfers${query ? `?${query}` : ""}`);
};
exports.listAsaasTransfers = listAsaasTransfers;
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
