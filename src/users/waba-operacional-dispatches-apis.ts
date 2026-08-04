import {
  normalizeDispatchesApiKind,
  WABA_DISPATCHES_API_LABELS,
  type WabaDispatchesApiKind,
} from "../disparos/waba-dispatches-api-kind";

/** Resolve a lista efetiva de APIs atendidas (array novo ou campo legado singular). */
export const resolveOperacionalDispatchesApis = (user: {
  operacionalDispatchesApi?: WabaDispatchesApiKind | null;
  operacionalDispatchesApis?: WabaDispatchesApiKind[] | null;
}): WabaDispatchesApiKind[] => {
  const fromArray = Array.isArray(user.operacionalDispatchesApis)
    ? user.operacionalDispatchesApis
        .map((item) => normalizeDispatchesApiKind(item))
        .filter((item): item is WabaDispatchesApiKind => Boolean(item))
    : [];
  if (fromArray.length > 0) {
    return [...new Set(fromArray)];
  }
  const single = normalizeDispatchesApiKind(user.operacionalDispatchesApi);
  return single ? [single] : [];
};

export const operacionalServesDispatchesApi = (
  user: {
    operacionalDispatchesApi?: WabaDispatchesApiKind | null;
    operacionalDispatchesApis?: WabaDispatchesApiKind[] | null;
  },
  apiKind: WabaDispatchesApiKind,
): boolean => resolveOperacionalDispatchesApis(user).includes(apiKind);

export const formatOperacionalDispatchesApisLabel = (
  apis: WabaDispatchesApiKind[],
): string => {
  if (!apis.length) return "—";
  return apis.map((api) => WABA_DISPATCHES_API_LABELS[api]).join(" + ");
};

/**
 * Aceita array, valor único ou lista CSV.
 * Exige ao menos uma API quando `required`.
 */
export const parseOperacionalDispatchesApisInput = (
  value: unknown,
  options: { required?: boolean } = {},
): WabaDispatchesApiKind[] => {
  const collected: WabaDispatchesApiKind[] = [];

  const push = (raw: unknown) => {
    const parsed = normalizeDispatchesApiKind(raw);
    if (parsed && !collected.includes(parsed)) collected.push(parsed);
  };

  if (Array.isArray(value)) {
    for (const item of value) push(item);
  } else if (typeof value === "string" && value.includes(",")) {
    for (const part of value.split(",")) push(part);
  } else if (value != null && String(value).trim()) {
    push(value);
  }

  if (!collected.length && options.required) {
    throw new Error(
      "Selecione ao menos um tipo de disparos que este operacional atende (API Oficial e/ou API Alternativa).",
    );
  }
  return collected;
};
