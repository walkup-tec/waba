/** Tipos do grafo de conversas do aquecedor (pares + estatísticas por número). */

export type PairDirection = "a_to_b" | "b_to_a";

export type ConversationPair = {
  /** Nome canônico lexicograficamente menor. */
  a: string;
  /** Nome canônico lexicograficamente maior. */
  b: string;
  /** Envios A → B. */
  sentAB: number;
  /** Envios B → A. */
  sentBA: number;
  /** saldo = sentAB - sentBA */
  balance: number;
  lastMessageAt: string | null;
  lastDirection: PairDirection | null;
  totalMessages: number;
  /** Interações do par no dia (qualquer sentido). */
  usageToday: number;
  /** YYYY-MM-DD America/Sao_Paulo para usageToday. */
  dayKey: string;
  createdAt: string;
  updatedAt: string;
};

export type PhoneStatistics = {
  phone: string;
  sentToday: number;
  receivedToday: number;
  sentTotal: number;
  receivedTotal: number;
  lastConversationAt: string | null;
  lastSentAt: string | null;
  lastReceivedAt: string | null;
  /** YYYY-MM-DD America/Sao_Paulo — contadores diários. */
  dayKey: string;
};

export type PairSelectionRecord = {
  at: string;
  pairKey: string;
  origem: string;
  destino: string;
  score: number;
  reason: string;
  breakdown: PairScoreBreakdown;
};

export type PairScoreBreakdown = {
  balanceScore: number;
  volumeScore: number;
  repetitionPenalty: number;
  coverageScore: number;
  participationScore: number;
  historyScore: number;
  total: number;
};

export type OwnerConversationGraph = {
  pairs: Record<string, ConversationPair>;
  phones: Record<string, PhoneStatistics>;
  updatedAt: string;
  /** true após bootstrap a partir de envios históricos. */
  bootstrapped: boolean;
  /** Último par escolhido (anti-repetição de relacionamento). */
  lastSelectedPairKey: string | null;
  /** Histórico das últimas seleções do algoritmo. */
  selectionHistory: PairSelectionRecord[];
};

export type ConversationGraphStore = {
  owners: Record<string, OwnerConversationGraph>;
};

export type DirectedExchangeEvent = {
  at: string;
  fromInst: string;
  toInst: string;
};

export type PairPickCandidate = {
  origem: string;
  destino: string;
  pairKey: string;
  balance: number;
  absBalance: number;
  score: number;
  reason: string;
  breakdown: PairScoreBreakdown;
};

export type NetworkHealthPhoneRow = {
  phone: string;
  sentToday: number;
  receivedToday: number;
  sentTotal: number;
  receivedTotal: number;
  diffToday: number;
  totalToday: number;
};

export type NetworkHealthPairRow = {
  pairKey: string;
  a: string;
  b: string;
  sentAB: number;
  sentBA: number;
  balance: number;
  absBalance: number;
  totalMessages: number;
  usageToday: number;
  lastMessageAt: string | null;
  lastDirection: PairDirection | null;
};

export type RelationshipMatrix = {
  labels: string[];
  /** matrix[i][j] = total mensagens entre labels[i] e labels[j] (simétrica; diagonal null). */
  cells: Array<Array<number | null>>;
};

export type NetworkHealthReport = {
  ownerEmail: string;
  generatedAt: string;
  totalMessages: number;
  pairCount: number;
  phoneCount: number;
  reciprocityPercent: number;
  avgSentToday: number;
  avgReceivedToday: number;
  unbalancedPairCount: number;
  /** Cobertura: pares com ≥1 mensagem / pares possíveis. */
  networkCoveragePercent: number;
  pairUsageStdDev: number;
  pairUsageMax: number;
  pairUsageMin: number;
  pairUsageSpread: number;
  relationshipMatrix: RelationshipMatrix;
  mostUsedPairs: NetworkHealthPairRow[];
  leastUsedPairs: NetworkHealthPairRow[];
  selectionHistory: PairSelectionRecord[];
  lastPick: PairSelectionRecord | null;
  phones: NetworkHealthPhoneRow[];
  pairs: NetworkHealthPairRow[];
  topUnbalancedPairs: NetworkHealthPairRow[];
  mostActivePhones: NetworkHealthPhoneRow[];
  leastActivePhones: NetworkHealthPhoneRow[];
  balanceRanking: NetworkHealthPairRow[];
};
