import express from "express";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase (criado sob demanda para evitar travamentos quando faltar config)
let supabaseClient: ReturnType<typeof createClient> | null = null;
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

const EVO_API_URL =
  process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080";
const EVO_INSTANCES_URL =
  process.env.EVO_INSTANCES_URL ||
  `${EVO_API_URL.replace(/\/$/, "")}/instance/fetchInstances`;
const EVO_API_KEY =
  process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11";

// __dirname (em dev) é "src", então subimos um nível e usamos "dist"
const rootPath = path.join(__dirname, "..");
const distPath = path.join(rootPath, "dist");

app.use(express.static(distPath));

app.get("/", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Dados direto do banco (view logs_envios_br já com fuso tratado)
app.get("/dados", async (req, res) => {
  try {
    const rangeStart =
      typeof req.query.rangeStart === "string" ? req.query.rangeStart : null;
    const rangeEnd =
      typeof req.query.rangeEnd === "string" ? req.query.rangeEnd : null;

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error: "Supabase não configurado no servidor (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).",
      });
    }

    const isValidYMD = (ymd: string) => /^\d{4}-\d{2}-\d{2}$/.test(ymd);

    const dateToNextDayYMD = (ymd: string) => {
      // ymd: YYYY-MM-DD
      if (!isValidYMD(ymd)) {
        throw new Error("Formato de data inválido");
      }
      const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
      const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      dt.setUTCDate(dt.getUTCDate() + 1);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    };

    let query = supabase
      .from("logs_envios_br")
      .select(
        "id, ciclo_global, instancia_origem, instancia_destino, created_at, data_envio_br"
      )
      .order("data_envio_br", { ascending: false });

    let totalCount: number | null = null;
    let countsBySender: Record<string, number> | null = null;

    if (rangeStart && rangeEnd) {
      if (!isValidYMD(rangeStart) || !isValidYMD(rangeEnd)) {
        return res.status(400).json({ error: "rangeStart/rangeEnd devem ser YYYY-MM-DD" });
      }
      // data_envio_br já vem da view com fuso tratado (America/Sao_Paulo).
      // Como a query retorna em formato timestamp sem timezone (no geral),
      // comparamos por "timestamp sem fuso" usando literais "YYYY-MM-DD HH:MM:SS".
      const startTs = `${rangeStart} 00:00:00`;
      const endExclusive = dateToNextDayYMD(rangeEnd);
      const endTs = `${endExclusive} 00:00:00`;

      // Count exato para bater com o SQL da view (sem precisar trazer todas as linhas)
      const { count, error: countError } = await supabase
        .from("logs_envios_br")
        .select("id", { count: "exact", head: true })
        .gte("data_envio_br", startTs)
        .lt("data_envio_br", endTs);

      if (!countError && typeof count === "number") {
        totalCount = count;
      } else {
        console.error("Erro count exato:", countError);
      }

      // Distribuição por instância de origem (para gráfico de barras)
      // O PostgREST pode limitar ~1000 linhas por request e agregações podem ser desabilitadas.
      // Então paginamos e contamos no backend para bater exatamente com a contagem exata.
      if (typeof totalCount === "number" && totalCount > 0) {
        countsBySender = {};

        const pageSize = 1000;
        let offset = 0;
        let safety = 0;

        while (offset < totalCount && safety < 50) {
          safety += 1;

          const { data: senderRows, error: senderErr } = await supabase
            .from("logs_envios_br")
            .select("instancia_origem")
            .gte("data_envio_br", startTs)
            .lt("data_envio_br", endTs)
            .order("data_envio_br", { ascending: false })
            .range(offset, offset + pageSize - 1);

          if (senderErr) {
            console.error("Erro countsBySender pagination:", senderErr);
            break;
          }

          if (!senderRows || senderRows.length === 0) break;

          senderRows.forEach((r: any) => {
            const key = r?.instancia_origem || "—";
            countsBySender![key] = (countsBySender![key] || 0) + 1;
          });

          offset += senderRows.length;
          if (senderRows.length < pageSize) break;
        }
      }

      // Linhas limitadas para montar lista/gráficos (o PostgREST pode limitar ~1000)
      query = query.gte("data_envio_br", startTs).lt("data_envio_br", endTs).limit(5000);
    } else {
      query = query.limit(2000);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro Supabase:", error);
      return res
        .status(500)
        .json({ error: "Erro ao buscar dados no Supabase" });
    }

    const rows = data ?? [];

    const texto = rows
      .map((row: any) => {
        const dataHora = row.data_envio_br || row.created_at || "";
        const quemEnviou = row.instancia_origem || "";
        const quemRecebeu = row.instancia_destino || "";

        return `Data/Hora: ${dataHora}\nQuem enviou: ${quemEnviou}\nQuem recebeu: ${quemRecebeu}`;
      })
      .join("\n-----------------------------\n");

    return res.json({ log: texto, count: rows.length, totalCount, countsBySender });
  } catch (error) {
    console.error("Erro ao buscar dados no Supabase:", error);
    return res.status(500).json({ error: "Erro ao buscar dados no Supabase" });
  }
});

// Status das instancias (Evolution API)
app.get("/instancias", async (_req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(EVO_INSTANCES_URL, {
        headers: {
          apikey: EVO_API_KEY,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const bodyText = await response.text();
      console.error("Erro Evolution API:", response.status, bodyText);
      return res
        .status(500)
        .json({ error: "Erro ao buscar dados na Evolution API" });
    }

    const instances: any[] = await response.json();

    let ativas = 0;
    let desconectadas = 0;

    for (const inst of instances) {
      if (inst.connectionStatus === "open") {
        ativas += 1;
      } else {
        desconectadas += 1;
      }
    }

    const total = instances.length;

    // Retorna apenas campos úteis para a UI (evita expor payload sensível)
    const items = instances.slice(0, 100).map((inst: any, idx: number) => {
      const candidateName =
        inst.instanceName ??
        inst.name ??
        inst.id ??
        inst.instanceId ??
        inst.instance ??
        null;

      const displayName =
        candidateName == null || candidateName === ""
          ? `Instância ${idx + 1}`
          : String(candidateName);

      const connectionStatus =
        typeof inst.connectionStatus === "string"
          ? inst.connectionStatus
          : "unknown";

      return { name: displayName, connectionStatus };
    });

    return res.json({ total, ativas, desconectadas, items });
  } catch (error) {
    console.error("Erro ao consultar Evolution API:", error);
    return res
      .status(500)
      .json({ error: "Erro ao consultar Evolution API" });
  }
});

app.listen(PORT, () => {
  console.log(`Disparador N8 - servidor rodando em http://localhost:${PORT}`);
});

