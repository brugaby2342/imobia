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
- Ao listar imóveis, inclua: tipo, bairro/cidade/UF, valor, área (m²), quartos, situação documental e uma linha de descrição quando existir.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: ChatMessage[] };
        const messages = body.messages;
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("Messages required", { status: 400 });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
        );

        const buscarImoveis = tool({
          description:
            "Busca imóveis no portfólio da imobiliária. Aplique apenas os filtros mencionados pelo usuário; deixe os outros indefinidos. Retorna até 20 imóveis.",
          inputSchema: z.object({
            tipo: z.string().nullable().describe("Ex: apartamento, casa, cobertura, terreno"),
            cidade: z.string().nullable(),
            bairro: z.string().nullable(),
            estado: z.string().nullable().describe("UF, ex: SC"),
            valor_min: z.number().nullable(),
            valor_max: z.number().nullable(),
            area_min: z.number().nullable().describe("Área mínima em m²"),
            area_max: z.number().nullable().describe("Área máxima em m²"),
            quartos_min: z.number().nullable(),
            status_documentacao: z.string().nullable(),
          }),
          execute: async (args) => {
            let q = supabase
              .from("imoveis")
              .select(
                "id, tipo, bairro, cidade, estado, valor, area_m2, quartos, status_documentacao, descricao",
              )
              .limit(20);
            if (args.tipo) q = q.ilike("tipo", `%${args.tipo}%`);
            if (args.cidade) q = q.ilike("cidade", `%${args.cidade}%`);
            if (args.bairro) q = q.ilike("bairro", `%${args.bairro}%`);
            if (args.estado) q = q.ilike("estado", `%${args.estado}%`);
            if (args.valor_min != null) q = q.gte("valor", args.valor_min);
            if (args.valor_max != null) q = q.lte("valor", args.valor_max);
            if (args.area_min != null) q = q.gte("area_m2", args.area_min);
            if (args.area_max != null) q = q.lte("area_m2", args.area_max);
            if (args.quartos_min != null) q = q.gte("quartos", args.quartos_min);
            if (args.status_documentacao)
              q = q.ilike("status_documentacao", `%${args.status_documentacao}%`);
            const { data, error } = await q;
            if (error) return { erro: error.message, imoveis: [] };
            return { total: data?.length ?? 0, imoveis: data ?? [] };
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
