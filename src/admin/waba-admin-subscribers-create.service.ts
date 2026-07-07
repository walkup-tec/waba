import { WabaSubscriberService } from "../subscribers/waba-subscriber.service";
import type { WabaSubscriberSegment } from "../subscribers/waba-subscriber-segment";

export type AdminCreateSubscriberInput = {
  email: string;
  password: string;
  fullName: string;
  whatsapp: string;
  phone?: string;
  cpfCnpj: string;
  aquecedorGranted?: boolean;
  segment: WabaSubscriberSegment | unknown;
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
      aquecedorGranted: input.aquecedorGranted === true,
      segment: input.segment,
    });
  }
}
