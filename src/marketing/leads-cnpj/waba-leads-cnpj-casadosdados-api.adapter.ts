import type { WabaLeadsCnpjFilters, WabaLeadsCnpjLead } from "./waba-leads-cnpj.types";
import { emptyLeadFromCnpj, normalizeCnpjDigits } from "./waba-leads-cnpj.repository";

export type CasaDosDadosApiProgress = (message: string) => void;

const API_BASE =
  String(process.env.CASADOSDADOS_API_BASE || "https://api.casadosdados.com.br").replace(/\/$/, "");

export function hasCasaDosDadosApiKey(): boolean {
  return Boolean(String(process.env.CASADOSDADOS_API_KEY || "").trim());
}

function readApiKey(): string {
  const key = String(process.env.CASADOSDADOS_API_KEY || "").trim();
  if (!key) {
    throw new Error(
      "CASADOSDADOS_API_KEY ausente. Gere em https://portal.casadosdados.com.br/plataforma/api/chave e configure no .env.v02.",
    );
  }
  return key;
}

function parseBrDateToIso(value?: string): string | undefined {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return undefined;
}

function parseMoneyInt(value?: string): number | undefined {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) ? n : undefined;
}

function porteCodigo(value?: string): string | undefined {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return undefined;
  if (/^01$|micro/.test(raw)) return "01";
  if (/^03$|pequeno|epp/.test(raw)) return "03";
  if (/^05$|demais|grande|medio|médio/.test(raw)) return "05";
  return undefined;
}

/** Monta o body da Pesquisa Avançada v5 a partir dos filtros da UI. */
export function buildCasaDosDadosPesquisaBody(
  filters: WabaLeadsCnpjFilters,
  pagina: number,
  limite: number,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    limite,
    pagina,
  };

  const cnpj = normalizeCnpjDigits(filters.cnpj || "");
  if (cnpj.length === 14) body.cnpj = [cnpj];

  const busca = String(filters.buscaTextual || "").trim();
  if (busca) {
    body.busca_textual = [
      {
        texto: [busca],
        tipo_busca: filters.tipoPesquisa === "Aproximada" ? "radical" : "exata",
        razao_social: filters.buscaEmRazaoSocial !== false,
        nome_fantasia: filters.buscaEmNomeFantasia !== false,
        nome_socio: filters.buscaEmNomeSocio !== false,
      },
    ];
  }

  const cnae = String(filters.atividadePrincipalCnae || "").replace(/\D/g, "");
  if (cnae) body.codigo_atividade_principal = [cnae];
  if (filters.incluirAtividadeSecundaria) body.incluir_atividade_secundaria = true;

  const natureza = String(filters.naturezaJuridica || "").replace(/\D/g, "");
  if (natureza) body.codigo_natureza_juridica = [natureza];

  const situacoes = (filters.situacaoCadastral || [])
    .map((s) => String(s || "").trim().toUpperCase())
    .filter(Boolean);
  if (situacoes.length) body.situacao_cadastral = situacoes;

  if (filters.somenteMatriz) body.matriz_filial = "MATRIZ";
  else if (filters.somenteFilial) body.matriz_filial = "FILIAL";

  const raiz = String(filters.cnpjRaiz || "").replace(/\D/g, "").slice(0, 8);
  if (raiz.length === 8) body.cnpj_raiz = [raiz];

  if (filters.cep) body.cep = [String(filters.cep).replace(/\D/g, "")];
  if (filters.estadoUf) body.uf = [String(filters.estadoUf).trim().toLowerCase()];
  if (filters.municipio) body.municipio = [String(filters.municipio).trim().toLowerCase()];
  if (filters.bairro) body.bairro = [String(filters.bairro).trim().toLowerCase()];
  if (filters.ddd) body.ddd = [String(filters.ddd).replace(/\D/g, "")];
  if (filters.telefone) body.telefone = [String(filters.telefone).replace(/\D/g, "")];

  const aberturaInicio = parseBrDateToIso(filters.dataAberturaDe);
  const aberturaFim = parseBrDateToIso(filters.dataAberturaAte);
  if (aberturaInicio || aberturaFim) {
    body.data_abertura = {
      ...(aberturaInicio ? { inicio: aberturaInicio } : {}),
      ...(aberturaFim ? { fim: aberturaFim } : {}),
    };
  }

  const capMin = parseMoneyInt(filters.capitalSocialMin);
  const capMax = parseMoneyInt(filters.capitalSocialMax);
  if (capMin != null || capMax != null) {
    body.capital_social = {
      ...(capMin != null ? { minimo: capMin } : {}),
      ...(capMax != null ? { maximo: capMax } : {}),
    };
  }

  const mei: Record<string, unknown> = {};
  if (filters.somenteMei) mei.optante = true;
  if (filters.excluirMei) mei.excluir_optante = true;
  if (filters.empresasExcluidasMei) {
    const ini = parseBrDateToIso(filters.excluidasMeiDe);
    const fim = parseBrDateToIso(filters.excluidasMeiAte);
    if (ini || fim) {
      mei.data_exclusao = {
        ...(ini ? { inicio: ini } : {}),
        ...(fim ? { fim } : {}),
      };
    }
  }
  if (Object.keys(mei).length) body.mei = mei;

  const simples: Record<string, unknown> = {};
  if (filters.empresasDoSimples) simples.optante = true;
  if (filters.excluirEmpresasDoSimples) simples.excluir_optante = true;
  if (filters.empresasExcluidasSimples) {
    const ini = parseBrDateToIso(filters.excluidasSimplesDe);
    const fim = parseBrDateToIso(filters.excluidasSimplesAte);
    if (ini || fim) {
      simples.data_exclusao = {
        ...(ini ? { inicio: ini } : {}),
        ...(fim ? { fim } : {}),
      };
    }
  }
  if (Object.keys(simples).length) body.simples = simples;

  const porte = porteCodigo(filters.porteEmpresa);
  if (porte) body.porte_empresa = { codigos: [porte] };

  const mais: Record<string, unknown> = {};
  if (filters.somenteMatriz) mais.somente_matriz = true;
  if (filters.somenteFilial) mais.somente_filial = true;
  if (filters.comEmail) mais.com_email = true;
  if (filters.comContatoTelefone) mais.com_telefone = true;
  if (filters.somenteFixo) mais.somente_fixo = true;
  if (filters.somenteCelular) mais.somente_celular = true;
  if (filters.excluirEmpresasVisualizadas) mais.excluir_empresas_visualizadas = true;
  if (filters.excluirEmailContab) mais.excluir_email_contab = true;
  if (Object.keys(mais).length) body.mais_filtros = mais;

  return body;
}

function mapApiItemToLead(item: Record<string, unknown>): WabaLeadsCnpjLead | null {
  const cnpj = normalizeCnpjDigits(item.cnpj || item.CNPJ);
  if (cnpj.length !== 14) return null;
  // Listagem: apenas CNPJ + Razão Social; o resto vem do enriquecimento.
  const lead = emptyLeadFromCnpj(cnpj);
  lead.nome = String(item.razao_social || item.nome || "").trim();
  return lead;
}

async function postPesquisa(
  apiKey: string,
  body: Record<string, unknown>,
  tipoResultado: "simples" | "completo",
): Promise<{ total: number; cnpjs: Record<string, unknown>[] }> {
  const url = `${API_BASE}/v5/cnpj/pesquisa?tipo_resultado=${tipoResultado}`;
  const controller = new AbortController();
  const timeoutMs = Math.max(15000, Number(process.env.CASADOSDADOS_API_TIMEOUT_MS || 60000) || 60000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      json = {};
    }
    if (!res.ok) {
      const msg =
        String(json.mensagem || json.message || json.error || text || "").slice(0, 300) ||
        `HTTP ${res.status}`;
      if (res.status === 401) {
        throw new Error(`Casa dos Dados API: chave inválida (${msg})`);
      }
      if (res.status === 403) {
        throw new Error(`Casa dos Dados API: sem saldo ou sem permissão (${msg})`);
      }
      throw new Error(`Casa dos Dados API falhou (${res.status}): ${msg}`);
    }
    const total = Number(json.total ?? 0);
    const cnpjs = Array.isArray(json.cnpjs) ? (json.cnpjs as Record<string, unknown>[]) : [];
    return { total: Number.isFinite(total) ? total : 0, cnpjs };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Coleta leads via API v5 (lê `total` e pagina com limite/pagina).
 * Preferível ao Playwright para volumes grandes (ex.: 46k empresas).
 */
export async function fetchCasaDosDadosLeadsViaApi(
  filters: WabaLeadsCnpjFilters,
  onProgress?: CasaDosDadosApiProgress,
): Promise<WabaLeadsCnpjLead[]> {
  const apiKey = readApiKey();
  const pageSize = Math.min(
    1000,
    Math.max(1, Math.round(Number(process.env.CASADOSDADOS_PAGE_SIZE || 100) || 100)),
  );
  const maxPagesCap = Math.max(0, Math.round(Number(filters.maxPages ?? 0) || 0));
  // Sempre "simples": listagem só precisa de CNPJ + razão social.
  const tipo: "simples" | "completo" = "simples";

  onProgress?.("Consultando total na API Casa dos Dados…");
  const firstBody = buildCasaDosDadosPesquisaBody(filters, 1, pageSize);
  const first = await postPesquisa(apiKey, firstBody, tipo);
  const total = first.total;
  const totalPagesAvailable = total > 0 ? Math.ceil(total / pageSize) : 1;
  const pagesToFetch =
    maxPagesCap > 0
      ? Math.min(maxPagesCap, Math.max(1, totalPagesAvailable))
      : Math.max(1, totalPagesAvailable);

  onProgress?.(
    `Pesquisa retornou ${total.toLocaleString("pt-BR")} empresas. Coletando página 1/${pagesToFetch} (${pageSize}/página · só CNPJ + Razão Social)…`,
  );

  const collected = new Map<string, WabaLeadsCnpjLead>();
  const ingest = (items: Record<string, unknown>[]) => {
    for (const item of items) {
      const lead = mapApiItemToLead(item);
      if (!lead) continue;
      if (!collected.has(lead.cnpj)) collected.set(lead.cnpj, lead);
    }
  };
  ingest(first.cnpjs);

  for (let pagina = 2; pagina <= pagesToFetch; pagina += 1) {
    onProgress?.(
      `Pesquisa retornou ${total.toLocaleString("pt-BR")} empresas. Coletando página ${pagina}/${pagesToFetch} (${collected.size.toLocaleString("pt-BR")} CNPJs)…`,
    );
    const page = await postPesquisa(
      apiKey,
      buildCasaDosDadosPesquisaBody(filters, pagina, pageSize),
      tipo,
    );
    if (!page.cnpjs.length) break;
    ingest(page.cnpjs);
    if (collected.size >= total && total > 0) break;
  }

  if (!collected.size) {
    throw new Error(
      total === 0
        ? "API Casa dos Dados: pesquisa retornou 0 empresas para estes filtros."
        : "API Casa dos Dados: nenhuma empresa mapeada nas páginas coletadas.",
    );
  }

  onProgress?.(
    `Coletados ${collected.size.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} (CNPJ + Razão Social · páginas ${pagesToFetch}/${totalPagesAvailable}). Enriquecimento na sequência.`,
  );
  return [...collected.values()];
}
