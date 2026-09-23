export type AdsPowerProfileRecord = {
  userId: string;
  serialNumber: string;
  name: string;
  groupId: string;
  groupName: string;
  remark: string;
  ipCountry: string;
  lastOpenTime: string | null;
  ingestedAt: string;
  connectionId: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
};

export type AdsPowerIngestItem = {
  userId?: string;
  user_id?: string;
  serialNumber?: string;
  serial_number?: string;
  name?: string;
  groupId?: string;
  group_id?: string;
  groupName?: string;
  group_name?: string;
  remark?: string;
  ipCountry?: string;
  ip_country?: string;
  lastOpenTime?: string | number | null;
  last_open_time?: string | number | null;
};

export type AdsPowerStore = {
  version: 1;
  updatedAt: string;
  profiles: AdsPowerProfileRecord[];
};

export type AdsPowerBridgeStatus = {
  configured: boolean;
  reachable: boolean;
  mode: "ingest" | "local-api" | "offline";
  baseUrl: string;
  detail: string;
};
