"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminSubscribersCreateService = void 0;
const waba_subscriber_service_1 = require("../subscribers/waba-subscriber.service");
class WabaAdminSubscribersCreateService {
    constructor(subscriberService = new waba_subscriber_service_1.WabaSubscriberService()) {
        this.subscriberService = subscriberService;
    }
    createSubscriber(input) {
        return this.subscriberService.register({
            email: String(input.email ?? ""),
            password: String(input.password ?? ""),
            fullName: String(input.fullName ?? ""),
            whatsapp: String(input.whatsapp ?? ""),
            phone: String(input.phone ?? ""),
            cpfCnpj: String(input.cpfCnpj ?? ""),
            aquecedorGranted: input.aquecedorGranted === true,
            segment: input.segment,
        });
    }
}
exports.WabaAdminSubscribersCreateService = WabaAdminSubscribersCreateService;
