/**
 * Simula compra paga de números API Alternativa (saldo por ownerEmail).
 * Uso: npx ts-node scripts/simulate-alternativa-numbers-purchase.ts walkup@walkuptec.com.br 30
 */
import "../src/load-env";
import { WabaAlternativaNumbersService } from "../src/billing/waba-alternativa-numbers.service";

const email = String(process.argv[2] ?? "").trim().toLowerCase();
const quantity = Math.round(Number(process.argv[3] ?? 0));

if (!email.includes("@") || !Number.isFinite(quantity) || quantity < 1) {
  console.error("Uso: npx ts-node scripts/simulate-alternativa-numbers-purchase.ts <email> <quantidade>");
  process.exit(1);
}

const service = new WabaAlternativaNumbersService();
const result = service.simulatePaidPurchase(email, quantity);
console.log(JSON.stringify(result, null, 2));
