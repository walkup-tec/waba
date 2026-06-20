"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveWabaRequestAuth = void 0;
const waba_auth_service_1 = require("./waba-auth.service");
const resolveWabaRequestAuth = (req) => {
    const token = (0, waba_auth_service_1.readWabaSessionCookie)(req.headers.cookie);
    const session = (0, waba_auth_service_1.verifyWabaSessionToken)(token);
    if (!session)
        return { email: "", role: "guest" };
    return {
        email: session.email,
        role: (0, waba_auth_service_1.resolveSessionRole)(session),
    };
};
exports.resolveWabaRequestAuth = resolveWabaRequestAuth;
