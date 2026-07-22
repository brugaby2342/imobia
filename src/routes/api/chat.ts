import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const SYSTEM_PROMPT = `Você é o ImobIA, copiloto de consulta do portfólio da imobiliária Litoral Prime (litoral de Santa Catarina).

REGRAS ESTRITAS:
- Responda SOMENTE com base nos dados retornados pela ferramenta buscar_imoveis.
- Nunca invente imóveis, características, endereços, valores ou fotos.
- Se a busca não retornar resultados, diga isso claramente e sugira ajustar os filtros. Não sugira imóveis fora da base.
- Não exponha dados de proprietários; apenas características comerciais.
- Sempre chame buscar_imoveis antes de listar imóveis. Se o usuário só cumprimentar ou fizer pergunta genérica, explique brevemente o que você faz.
- Formate valores em BRL (R$ 850.000). Use "Área (m²)" e "Situação documental" como rótulos.
- Seja conciso, corporativo e útil. Responda em português do Brasil. Use markdown (listas, negrito) quando ajudar.
- Ao listar imóveis, NÃO repita os detalhes em texto: os imóveis serão renderizados como cards visuais pelo frontend a partir dos dados estruturados. Apenas escreva uma introdução curta (1-2 frases) resumindo o que foi encontrado (ex: "Encontrei 3 apartamentos em Balneário Camboriú dentro do seu orçamento:"). Não liste tipo, valor, área, etc. em texto.
- Quando a tool buscar_imoveis retornar { cidade_fora_portfolio: true }: explique que a Litoral Prime não atua na cidade solicitada e liste as cidades disponíveis retornadas em cidades_disponiveis. Não sugira alternativas fora dessa lista.
- Quando a tool retornar imóveis vazios mas a cidade EXISTE no portfólio (cidade_fora_portfolio ausente/false e total = 0): diga que não há imóveis com aquelas características naquela cidade e sugira ajustar os filtros (ex: ampliar faixa de valor, remover algum critério).`;

function isNewSupabaseApiKey(v: string) {
  return v.startsWith("sb_publishable_") || v.startsWith("sb_secret_");
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") || "";
        if (!authHeader.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { messages?: ChatMessage[] };
        const messages = body.messages;
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("Messages required", { status: 400 });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

        // Authenticated client: acts as the signed-in user (RLS applies).
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          global: {
            headers: { Authorization: `Bearer ${token}` },
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (
                isNewSupabaseApiKey(SUPABASE_PUBLISHABLE_KEY) &&
                headers.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
              ) {
                headers.delete("Authorization");
              }
              headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
              // Preserve the user bearer for PostgREST RLS
              if (!headers.get("Authorization")) headers.set("Authorization", `Bearer ${token}`);
              return fetch(input, { ...init, headers });
            },
          },
        });

        // Validate the token
        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }


        const parseNumber = (v: unknown): number | null => {
          if (v === null || v === undefined || v === "") return null;
          if (typeof v === "number") return Number.isFinite(v) ? v : null;
          if (typeof v !== "string") return null;
          let s = v.toLowerCase().trim();
          s = s.replace(/r\$/g, "").replace(/m²|m2/g, "").replace(/\s+/g, " ").trim();
          let multiplier = 1;
          if (/\bmilh(ão|ões|oes)\b|\bmi\b/.test(s)) multiplier = 1_000_000;
          else if (/\bmil\b|\bk\b/.test(s)) multiplier = 1_000;
          s = s.replace(/\bmilh(ão|ões|oes)\b|\bmi\b|\bmil\b|\bk\b/g, "").trim();
          if (s.includes(",")) {
            s = s.replace(/\./g, "").replace(",", ".");
          } else {
            const parts = s.split(".");
            if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
              s = s.replace(/\./g, "");
            }
          }
          s = s.replace(/[^0-9.\-]/g, "");
          if (!s) return null;
          const n = Number(s);
          return Number.isFinite(n) ? n * multiplier : null;
        };
        const parseInt10 = (v: unknown): number | null => {
          const n = parseNumber(v);
          return n === null ? null : Math.trunc(n);
        };
        const numish = z.union([z.number(), z.string()]).nullish();
        const strish = z.string().nullish();

        const buscarImoveis = tool({
          description:
            "Busca imóveis no portfólio da imobiliária. Aplique apenas os filtros mencionados pelo usuário; deixe os outros como null. Aceita valores em texto (ex: '800 mil', 'R$ 1,2 milhão'). Retorna até 20 imóveis.",
          inputSchema: z.object({
            tipo: strish.describe("Ex: apartamento, casa, cobertura, terreno"),
            cidade: strish,
            bairro: strish,
            estado: strish.describe("UF, ex: SC"),
            valor_min: numish,
            valor_max: numish,
            area_min: numish.describe("Área mínima em m²"),
            area_max: numish.describe("Área máxima em m²"),
            quartos_min: numish,
            status_documentacao: strish,
          }),
          execute: async (args) => {
            const tipo = args.tipo?.trim() || null;
            const cidade = args.cidade?.trim() || null;
            const bairro = args.bairro?.trim() || null;
            const estado = args.estado?.trim() || null;
            const statusDoc = args.status_documentacao?.trim() || null;
            const valorMin = parseNumber(args.valor_min);
            const valorMax = parseNumber(args.valor_max);
            const areaMin = parseNumber(args.area_min);
            const areaMax = parseNumber(args.area_max);
            const quartosMin = parseInt10(args.quartos_min);

            let q = supabase
              .from("imoveis")
              .select(
                "id, tipo, bairro, cidade, estado, valor, area_m2, quartos, status_documentacao, descricao",
              )
              .limit(20);
            if (tipo) q = q.ilike("tipo", `%${tipo}%`);
            if (cidade) q = q.ilike("cidade", `%${cidade}%`);
            if (bairro) q = q.ilike("bairro", `%${bairro}%`);
            if (estado) q = q.ilike("estado", `%${estado}%`);
            if (valorMin !== null) q = q.gte("valor", valorMin);
            if (valorMax !== null) q = q.lte("valor", valorMax);
            if (areaMin !== null) q = q.gte("area_m2", areaMin);
            if (areaMax !== null) q = q.lte("area_m2", areaMax);
            if (quartosMin !== null) q = q.gte("quartos", quartosMin);
            if (statusDoc) q = q.ilike("status_documentacao", `%${statusDoc}%`);
            const { data, error } = await q;
            if (error) return { erro: error.message, imoveis: [] };
            const imoveis = data ?? [];
            if (imoveis.length === 0 && cidade) {
              const { data: cityCheck } = await supabase
                .from("imoveis")
                .select("id")
                .ilike("cidade", `%${cidade}%`)
                .limit(1);
              if (!cityCheck || cityCheck.length === 0) {
                const { data: allCities } = await supabase
                  .from("imoveis")
                  .select("cidade, estado");
                const uniq = Array.from(
                  new Set(
                    (allCities ?? [])
                      .map((r) => (r.cidade ? `${r.cidade}${r.estado ? "/" + r.estado : ""}` : null))
                      .filter((v): v is string => !!v),
                  ),
                ).sort();
                return {
                  total: 0,
                  imoveis: [],
                  cidade_fora_portfolio: true,
                  cidade_solicitada: cidade,
                  cidades_disponiveis: uniq,
                };
              }
            }
            return { total: imoveis.length, imoveis };
          },
        });

        try {
          const gateway = createLovableAiGatewayProvider(apiKey);
          const result = await generateText({
            model: gateway("google/gemini-2.5-flash"),
            system: SYSTEM_PROMPT,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            tools: { buscar_imoveis: buscarImoveis },
            stopWhen: stepCountIs(5),
          });
          return Response.json({ text: result.text });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const status = /429|rate/i.test(msg) ? 429 : /402|credit/i.test(msg) ? 402 : 500;
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
