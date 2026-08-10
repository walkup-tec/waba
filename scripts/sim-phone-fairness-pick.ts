import { pickNextRelationship } from "../src/aquecedor/relationship-manager.service";
import type {
  OwnerConversationGraph,
  ConversationPair,
  PhoneStatistics,
} from "../src/aquecedor/conversation-pair.types";

function phone(name: string, total: number): PhoneStatistics {
  const half = Math.floor(total / 2);
  return {
    phone: name,
    sentToday: 0,
    receivedToday: 0,
    sentTotal: half,
    receivedTotal: total - half,
    lastConversationAt: null,
    lastSentAt: null,
    lastReceivedAt: null,
    dayKey: "2026-08-10",
  };
}

function pair(a: string, b: string, ab: number, ba: number): ConversationPair {
  const [x, y] = a.localeCompare(b) <= 0 ? [a, b] : [b, a];
  const sentAB = a.localeCompare(b) <= 0 ? ab : ba;
  const sentBA = a.localeCompare(b) <= 0 ? ba : ab;
  return {
    a: x,
    b: y,
    sentAB,
    sentBA,
    balance: sentAB - sentBA,
    lastMessageAt: new Date().toISOString(),
    lastDirection: "a_to_b",
    totalMessages: sentAB + sentBA,
    usageToday: 2,
    dayKey: "2026-08-10",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const names = [
  "6019-01",
  "7943",
  "atendimento-8918",
  "atendimento-8927",
  "drax-oficial",
  "final-1267",
];

const owner: OwnerConversationGraph = {
  pairs: {
    "6019-01|7943": pair("6019-01", "7943", 28, 27),
  },
  phones: {
    "6019-01": phone("6019-01", 55),
    "7943": phone("7943", 50),
    "atendimento-8918": phone("atendimento-8918", 0),
    "atendimento-8927": phone("atendimento-8927", 4),
    "drax-oficial": phone("drax-oficial", 3),
    "final-1267": phone("final-1267", 0),
  },
  updatedAt: new Date().toISOString(),
  bootstrapped: true,
  lastSelectedPairKey: "6019-01|7943",
  selectionHistory: [],
};

const picks: string[] = [];
for (let i = 0; i < 12; i += 1) {
  const p = pickNextRelationship(owner, names, { startIndex: i });
  if (!p) {
    picks.push("null");
    break;
  }
  picks.push(`${p.pairKey} :: ${p.reason}`);
  const o = owner.phones[p.origem];
  const d = owner.phones[p.destino];
  if (o) o.sentTotal += 1;
  if (d) d.receivedTotal += 1;
  owner.lastSelectedPairKey = p.pairKey;
  let pairRow = owner.pairs[p.pairKey];
  if (!pairRow) {
    pairRow = pair(p.origem, p.destino, 0, 0);
    owner.pairs[p.pairKey] = pairRow;
  }
  if (p.origem === pairRow.a) pairRow.sentAB += 1;
  else pairRow.sentBA += 1;
  pairRow.balance = pairRow.sentAB - pairRow.sentBA;
  pairRow.totalMessages = pairRow.sentAB + pairRow.sentBA;
}

const finals = names
  .map((n) => ({
    n,
    t: (owner.phones[n].sentTotal || 0) + (owner.phones[n].receivedTotal || 0),
  }))
  .sort((a, b) => b.t - a.t);

const coldTouched = picks.filter(
  (p) =>
    p.includes("atendimento-8918") ||
    p.includes("final-1267") ||
    p.includes("drax-oficial") ||
    p.includes("atendimento-8927"),
).length;

console.log(JSON.stringify({ picks, finals, coldTouched }, null, 2));
