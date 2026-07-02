import { WabaSubscriberService } from "../subscribers/waba-subscriber.service";

export type AdminCreateSubscriberInput = {
  email: string;
  password: string;
  fullName: string;
  whatsapp: string;
  phone?: string;
  cpfCnpj: string;
};

export class WabaAdminSubscribersCreateService {
  constructor(private readonly subscriberService = new WabaSubscriberService()) {}

  createSubscriber(input: AdminCreateSubscriberInput) {
    return this.subscriberService.register({
      email: String(input.email ?? ""),
      password: String(input.password ?? ""),
      fullName: String(input.fullName ?? ""),
      whatsapp: String(input.whatsapp ?? ""),
      phone: String(input.phone ?? ""),
      cpfCnpj: String(input.cpfCnpj ?? ""),
    });
  }
}
