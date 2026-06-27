export type WabaMenuSection = "nao-oficial" | "oficial" | "admin" | "suporte";

export type WabaMenuProfile = "all" | "production" | "full";

export type WabaMenuDefinition = {
  /** Identificador estável — usar em data-menu-key no HTML */
  id: string;
  label: string;
  tab: string;
  section: WabaMenuSection;
  sectionLabel: string;
  /** all = sempre no registry; production/full filtram na UI conforme perfil */
  profile: WabaMenuProfile;
};

export const WABA_MENU_SECTION_LABELS: Record<WabaMenuSection, string> = {
  "nao-oficial": "Aquecedor",
  oficial: "Disparos",
  admin: "Admin",
  suporte: "Suporte",
};

const SECTION_LABELS = WABA_MENU_SECTION_LABELS;

/**
 * Fonte única de menus do painel.
 * Ao criar menu novo: adicione aqui + data-menu-key no botão do index.html.
 * Usuários antigos ficam sem o novo menu até o master habilitar.
 */
export const WABA_MENU_REGISTRY: WabaMenuDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    tab: "dashboard",
    section: "nao-oficial",
    sectionLabel: SECTION_LABELS["nao-oficial"],
    profile: "all",
  },
  {
    id: "instancias",
    label: "Instâncias",
    tab: "instancias",
    section: "nao-oficial",
    sectionLabel: SECTION_LABELS["nao-oficial"],
    profile: "all",
  },
  {
    id: "aquecedor",
    label: "Aquecedor",
    tab: "aquecedor",
    section: "nao-oficial",
    sectionLabel: SECTION_LABELS["nao-oficial"],
    profile: "all",
  },
  {
    id: "disparos",
    label: "Disparos",
    tab: "disparos",
    section: "nao-oficial",
    sectionLabel: SECTION_LABELS["nao-oficial"],
    profile: "full",
  },
  {
    id: "disparos-dashboard",
    label: "Dashboard",
    tab: "disparos-dashboard",
    section: "oficial",
    sectionLabel: SECTION_LABELS.oficial,
    profile: "production",
  },
  {
    id: "disparos-lancamento",
    label: "Créditos",
    tab: "disparos-lancamento",
    section: "oficial",
    sectionLabel: SECTION_LABELS.oficial,
    profile: "production",
  },
  {
    id: "disparo-evo",
    label: "API Alternativa",
    tab: "disparo-evo",
    section: "oficial",
    sectionLabel: SECTION_LABELS.oficial,
    profile: "production",
  },
  {
    id: "campanhas",
    label: "API Oficial",
    tab: "disparos",
    section: "oficial",
    sectionLabel: SECTION_LABELS.oficial,
    profile: "production",
  },
  {
    id: "meta-ativos",
    label: "1) Ativos API",
    tab: "meta-ativos",
    section: "oficial",
    sectionLabel: SECTION_LABELS.oficial,
    profile: "full",
  },
  {
    id: "meta-templates",
    label: "2) Templates",
    tab: "meta-templates",
    section: "oficial",
    sectionLabel: SECTION_LABELS.oficial,
    profile: "full",
  },
  {
    id: "meta-disparo",
    label: "3) Disparo API",
    tab: "meta-disparo",
    section: "oficial",
    sectionLabel: SECTION_LABELS.oficial,
    profile: "full",
  },
  {
    id: "admin-dashboard",
    label: "Dashboard",
    tab: "admin-dashboard",
    section: "admin",
    sectionLabel: SECTION_LABELS.admin,
    profile: "all",
  },
  {
    id: "admin-assinantes",
    label: "Assinantes",
    tab: "admin-assinantes",
    section: "admin",
    sectionLabel: SECTION_LABELS.admin,
    profile: "all",
  },
  {
    id: "admin-campanhas",
    label: "Campanhas",
    tab: "admin-campanhas",
    section: "admin",
    sectionLabel: SECTION_LABELS.admin,
    profile: "all",
  },
  {
    id: "admin-usuarios",
    label: "Usuários",
    tab: "admin-usuarios",
    section: "admin",
    sectionLabel: SECTION_LABELS.admin,
    profile: "all",
  },
  {
    id: "admin-financeiro",
    label: "Financeiro",
    tab: "admin-financeiro",
    section: "admin",
    sectionLabel: SECTION_LABELS.admin,
    profile: "all",
  },
  {
    id: "admin-chamados",
    label: "Chamados",
    tab: "admin-chamados",
    section: "suporte",
    sectionLabel: SECTION_LABELS.suporte,
    profile: "all",
  },
  {
    id: "admin-monitor-cpu",
    label: "Monitor CPU",
    tab: "admin-monitor-cpu",
    section: "suporte",
    sectionLabel: SECTION_LABELS.suporte,
    profile: "all",
  },
];

/** Menus Disparos visíveis para assinantes (UI produção / V02). */
export const WABA_SUBSCRIBER_DISPAROS_MENU_IDS = [
  "disparos-dashboard",
  "disparos-lancamento",
  "disparo-evo",
  "campanhas",
] as const;

export const listWabaMenuDefinitions = (): WabaMenuDefinition[] =>
  WABA_MENU_REGISTRY.map((item) => ({ ...item }));

export const getWabaMenuById = (menuId: string): WabaMenuDefinition | null => {
  const id = String(menuId ?? "").trim();
  return WABA_MENU_REGISTRY.find((item) => item.id === id) ?? null;
};

export const getWabaMenusByTab = (tab: string): WabaMenuDefinition[] => {
  const normalized = String(tab ?? "").trim();
  return WABA_MENU_REGISTRY.filter((item) => item.tab === normalized);
};

export const listWabaMenuIds = (): string[] => WABA_MENU_REGISTRY.map((item) => item.id);
