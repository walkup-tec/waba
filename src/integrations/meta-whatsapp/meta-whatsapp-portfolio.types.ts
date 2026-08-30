export type MetaPortfolioDispatchStatus = "livre" | "em_disparo";

export type MetaPortfolioNumberUiStatus = "ativo" | "pendente";

export type MetaProfileSyncStatus = "pending" | "applied" | "ready" | "declined";

export type MetaPortfolioPublic = {
  id: string | null;
  name: string | null;
  primaryPageId: string | null;
  primaryPageName: string | null;
  profilePictureUrl: string | null;
  wabaId: string | null;
  connectionId?: string | null;
};

export type MetaPortfolioNumberPublic = {
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  metaStatus: string | null;
  codeVerificationStatus: string | null;
  uiStatus: MetaPortfolioNumberUiStatus;
  dispatchStatus: MetaPortfolioDispatchStatus;
  canActivate: boolean;
  nameNeedsRegister: boolean;
  nameStatus: string | null;
  newDisplayName: string | null;
  newNameStatus: string | null;
  profilePictureUrl: string | null;
  vertical: string | null;
  description: string | null;
  address: string | null;
  email: string | null;
  requestedName: string | null;
  nameSyncStatus: MetaProfileSyncStatus | null;
  photoSyncStatus: MetaProfileSyncStatus | null;
  profileSyncStatus: MetaProfileSyncStatus | null;
  inboxEnabled: boolean;
};

export type MetaPortfolioAssetsPublic = {
  portfolios?: MetaPortfolioPublic[];
  selectedConnectionId?: string | null;
  portfolio: MetaPortfolioPublic | null;
  numbers: MetaPortfolioNumberPublic[];
};
