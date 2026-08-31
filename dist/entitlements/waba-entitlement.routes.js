"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaEntitlementRoutes = void 0;
const waba_auth_service_1 = require("../auth/waba-auth.service");
const waba_entitlement_service_1 = require("./waba-entitlement.service");
const entitlementService = new waba_entitlement_service_1.WabaEntitlementService();
const resolveRequestAuth = (req) => {
    const token = (0, waba_auth_service_1.readWabaSessionCookie)(req.headers.cookie);
    const session = (0, waba_auth_service_1.verifyWabaSessionToken)(token);
    if (!session)
        return { email: "", role: "guest" };
    return {
        email: session.email,
        role: (0, waba_auth_service_1.resolveSessionRole)(session),
    };
};
const registerWabaEntitlementRoutes = (app) => {
    app.get("/entitlements/aquecedor", (req, res) => {
        const auth = resolveRequestAuth(req);
        const entitlement = entitlementService.getAquecedorEntitlement(auth.email, auth.role);
        return res.status(200).json({
            ...entitlement,
            role: auth.role,
        });
    });
};
exports.registerWabaEntitlementRoutes = registerWabaEntitlementRoutes;
