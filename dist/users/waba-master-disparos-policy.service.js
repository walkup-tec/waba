"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaMasterDisparosPolicyService = exports.parseMasterDisparosPolicyInput = exports.resolveMasterDisparosPolicyFromUser = exports.DEFAULT_MASTER_DISPAROS_POLICY = void 0;
const waba_auth_service_1 = require("../auth/waba-auth.service");
const waba_system_user_service_1 = require("./waba-system-user.service");
exports.DEFAULT_MASTER_DISPAROS_POLICY = {
    unlimitedCredits: true,
    splitSuppliers: true,
    splitProfits: false,
};
const normalizeEmail = (value) => value.trim().toLowerCase();
const resolveMasterDisparosPolicyFromUser = (user) => ({
    unlimitedCredits: user.masterUnlimitedCredits ?? exports.DEFAULT_MASTER_DISPAROS_POLICY.unlimitedCredits,
    splitSuppliers: user.masterSplitSuppliers ?? exports.DEFAULT_MASTER_DISPAROS_POLICY.splitSuppliers,
    splitProfits: user.masterSplitProfits ?? exports.DEFAULT_MASTER_DISPAROS_POLICY.splitProfits,
});
exports.resolveMasterDisparosPolicyFromUser = resolveMasterDisparosPolicyFromUser;
const parseMasterDisparosPolicyInput = (input, options = {}) => {
    const applyDefaults = options.applyDefaults !== false;
    return {
        unlimitedCredits: input.masterUnlimitedCredits === undefined
            ? exports.DEFAULT_MASTER_DISPAROS_POLICY.unlimitedCredits
            : input.masterUnlimitedCredits !== false,
        splitSuppliers: input.masterSplitSuppliers === undefined
            ? applyDefaults
                ? exports.DEFAULT_MASTER_DISPAROS_POLICY.splitSuppliers
                : false
            : input.masterSplitSuppliers !== false,
        splitProfits: input.masterSplitProfits === true,
    };
};
exports.parseMasterDisparosPolicyInput = parseMasterDisparosPolicyInput;
class WabaMasterDisparosPolicyService {
    constructor(systemUserService = new waba_system_user_service_1.WabaSystemUserService()) {
        this.systemUserService = systemUserService;
    }
    resolveForEmail(email) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return null;
        const user = this.systemUserService.getByEmail(normalized);
        if (user?.role === "master") {
            return (0, exports.resolveMasterDisparosPolicyFromUser)(user);
        }
        if ((0, waba_auth_service_1.isWabaMasterEmail)(normalized)) {
            return { ...exports.DEFAULT_MASTER_DISPAROS_POLICY };
        }
        return null;
    }
    hasUnlimitedCredits(email) {
        return this.resolveForEmail(email)?.unlimitedCredits === true;
    }
}
exports.WabaMasterDisparosPolicyService = WabaMasterDisparosPolicyService;
