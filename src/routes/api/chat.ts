import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const SYSTEM_PROMPT = `Você é o ImobIA, copiloto corporativo da imobiliária Litoral Prime (litoral de Santa Catarina). Você atende corretores em duas especialidades: PORTFÓLIO DE IMÓVEIS e BASE DOCUMENTAL.

## Roteamento de ferramentas
- Perguntas sobre características, valores, área, quartos, localização ou disponibilidade de imóveis → use SEMPRE buscar_imoveis.
- Perguntas sobre normas, procedimentos, contratos, cláusulas, políticas internas, documentação exigida ou conteúdo de arquivos → use SEMPRE buscar_documentos.
- Se a pergunta envolver os dois domínios, use as duas ferramentas.
- Nunca responda sobre imóveis ou documentos sem antes chamar a ferramenta correspondente.

## Regras — Imóveis
- Responda SOMENTE com base no que buscar_imoveis retornar. Nunca invente imóveis, endereços, valores ou fotos.
- Formate valores em BRL (R$ 850.000). Use "Área (m²)" e "Situação documental" como rótulos.
- Ao listar imóveis, NÃO repita os detalhes em texto: os imóveis são renderizados como cards visuais pelo frontend. Escreva apenas uma introdução curta (1-2 frases) resumindo o que foi encontrado.
- Quando a tool retornar { cidade_fora_portfolio: true }: explique que a Litoral Prime não atua na cidade solicitada e liste as cidades disponíveis em cidades_disponiveis. Não sugira alternativas fora dessa lista.
- Quando a tool retornar imóveis vazios mas a cidade EXISTE no portfólio: diga que não há imóveis com aquelas características e sugira ajustar os filtros (ampliar faixa de valor, remover algum critério).

## Regras — Documentos
- Responda SOMENTE com base no conteúdo devolvido por buscar_documentos. Nunca invente cláusulas, prazos, regras ou trechos.
- SEMPRE cite o nome/título do documento (e a categoria, quando útil) que embasa cada afirmação. Quando o documento estiver vinculado a um imóvel, mencione o vínculo.
- Cite trechos curtos entre aspas quando forem decisivos; não copie o documento inteiro.
- Quando a tool retornar { sem_correspondencia: true }, ela devolve documentos_disponiveis: informe ao corretor que não houve correspondência para o termo e liste os documentos existentes (título, categoria e vínculo) para que ele reformule a pergunta. Não diga apenas "não encontrei".
- Se o conteúdo devolvido estiver truncado (truncado: true), diga que a resposta cobre apenas parte do documento.

## Regras gerais
- Não exponha dados de proprietários; apenas informações comerciais e normativas.
- Seja conciso, corporativo e útil. Português do Brasil. Use markdown (listas, negrito) quando ajudar.
- Se o usuário só cumprimentar, explique brevemente o que você faz (consulta ao portfólio e à base documental).`;


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

        // ---- Busca textual acento/caixa-insensível ----
        // O Postgres do projeto não tem `unaccent` habilitado e não vamos alterar o banco.
        // Estratégia: normalizamos o termo (remove acentos, minúsculas) e trocamos as letras
        // que podem aparecer acentuadas por `_` (curinga de 1 caractere do LIKE), de modo que
        // "area", "área", "ÁREA" e "Area" casem com o mesmo padrão.
        const semAcento = (s: string) =>
          s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        const padraoInsensivel = (termo: string) =>
          semAcento(termo)
            .replace(/[%_\\,()]/g, " ")
            .trim()
            .replace(/[aeioucn]/g, "_");

        const STOPWORDS = new Set([
          "que","qual","quais","quanto","quantos","como","onde","para","por","com","sem",
          "uma","uns","umas","dos","das","nos","nas","pelo","pela","este","esta","esse",
          "essa","aquele","aquela","seu","sua","meu","minha","the","and","não","sim",
          "sobre","quando","tem","ter","ser","foi","são","era","mais","menos","muito",
          "todo","toda","todos","todas","exigido","preciso","precisa","favor","documento",
          "documentos","imovel","imoveis",
        ]);

        /** Quebra a pergunta em termos relevantes (>=4 letras, sem stopwords). */
        const termosRelevantes = (texto: string | null | undefined): string[] => {
          if (!texto) return [];
          const brutos = semAcento(texto)
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(Boolean);
          const uteis = brutos.filter((t) => t.length >= 4 && !STOPWORDS.has(t));
          return Array.from(new Set(uteis.length ? uteis : brutos.filter((t) => t.length >= 3)));
        };



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
            descricao_contem: strish.describe(
              "Filtro textual ADICIONAL e opcional aplicado à descrição do imóvel. Use para características que só aparecem no texto livre (ex: 'churrasqueira', 'vista para o mar', 'piscina aquecida', 'mobiliado'). Pode ser combinado com os demais filtros. Informe apenas as palavras-chave, sem frases inteiras.",
            ),
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
                "id, tipo, bairro, cidade, estado, valor, area_m2, quartos, status_documentacao, descricao, imovel_fotos(caminho_arquivo, ordem, id)",
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
            // Filtro textual adicional na descrição (acento/caixa-insensível).
            for (const t of termosRelevantes(args.descricao_contem)) {
              q = q.ilike("descricao", `%${padraoInsensivel(t)}%`);
            }

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

        // ---- Base documental ----
        const FULL_LIMIT = 8000; // documentos até este tamanho vão integrais
        const MARGIN = 4000; // margem generosa em torno do termo em documentos grandes

        /** Recorta um trecho amplo, alinhando às quebras de seção (linha em branco). */
        function trechoAmplo(texto: string, termo: string) {
          const idx = termo ? texto.toLowerCase().indexOf(termo.toLowerCase()) : -1;
          const center = idx >= 0 ? idx : 0;
          let start = Math.max(0, center - MARGIN);
          let end = Math.min(texto.length, center + termo.length + MARGIN);
          if (start > 0) {
            const br = texto.lastIndexOf("\n\n", start);
            start = br >= 0 ? br + 2 : texto.lastIndexOf("\n", start) + 1;
            if (start < 0) start = 0;
          }
          if (end < texto.length) {
            const br = texto.indexOf("\n\n", end);
            end = br >= 0 ? br : texto.length;
          }
          return {
            conteudo: texto.slice(start, end),
            truncado: start > 0 || end < texto.length,
          };
        }

        type DocRowLite = {
          id: number;
          titulo: string;
          categoria: string;
          descricao: string | null;
          imovel_id: number | null;
          conteudo_text: string | null;
        };

        const buscarDocumentos = tool({
          description:
            "Busca na base documental da imobiliária (normas, contratos, procedimentos, políticas internas, documentos vinculados a imóveis). Use para perguntas sobre conteúdo normativo, contratual ou procedimental — NÃO para características ou preços de imóveis. Passe a PERGUNTA ou o ASSUNTO no campo `termo`: cada palavra relevante é procurada separadamente no CONTEÚDO, no título e na descrição, ignorando acentos e maiúsculas. Não é necessário citar o nome do documento. Se nada casar, a tool devolve todos os documentos com o conteúdo deles.",
          inputSchema: z.object({
            termo: strish.describe(
              "Assunto ou pergunta do usuário (ex: 'o que é exigido para imóvel na planta'). Deixe null para listar todos os documentos.",
            ),
            categoria: strish.describe("Filtrar por categoria, ex: Contrato, Manual, Matrícula"),
            imovel_id: numish.describe("Filtrar documentos vinculados a um imóvel específico"),
          }),
          execute: async (args) => {
            const termo = args.termo?.trim() || null;
            const categoria = args.categoria?.trim() || null;
            const imovelId = parseInt10(args.imovel_id);

            const baseSelect = "id, titulo, categoria, descricao, imovel_id, conteudo_text";

            const montar = (rows: DocRowLite[], termoFoco: string) =>
              rows.map((d) => {
                const texto = d.conteudo_text ?? "";
                const integral = texto.length <= FULL_LIMIT;
                const { conteudo, truncado } = integral
                  ? { conteudo: texto, truncado: false }
                  : trechoAmplo(texto, termoFoco);
                return {
                  id: d.id,
                  titulo: d.titulo,
                  categoria: d.categoria,
                  descricao: d.descricao,
                  imovel_id: d.imovel_id,
                  vinculo: d.imovel_id ? `Imóvel #${d.imovel_id}` : "Documento institucional",
                  conteudo,
                  truncado,
                  tamanho_total: texto.length,
                };
              });

            /** Fallback: catálogo completo COM o conteúdo dos documentos. */
            const listarDisponiveis = async () => {
              const { data } = await supabase.from("documentos").select(baseSelect).limit(20);
              return montar((data ?? []) as DocRowLite[], "");
            };

            const termos = termosRelevantes(termo);

            let q = supabase.from("documentos").select(baseSelect).limit(10);
            if (categoria) q = q.ilike("categoria", `%${categoria}%`);
            if (imovelId !== null) q = q.eq("imovel_id", imovelId);
            // Cada termo relevante é procurado separadamente (OR) no conteúdo,
            // no título e na descrição — acento/caixa-insensível.
            if (termos.length) {
              const clauses = termos.flatMap((t) => {
                const p = padraoInsensivel(t);
                if (!p) return [];
                return [
                  `conteudo_text.ilike.%${p}%`,
                  `titulo.ilike.%${p}%`,
                  `descricao.ilike.%${p}%`,
                ];
              });
              if (clauses.length) q = q.or(clauses.join(","));
            }

            const { data, error } = await q;
            if (error) return { erro: error.message, documentos: [] };

            const rows = (data ?? []) as DocRowLite[];

            // FALLBACK: nenhum termo casou → devolve os documentos com o conteúdo.
            if (rows.length === 0) {
              return {
                total: 0,
                documentos: [],
                sem_correspondencia: true,
                termo_buscado: termo,
                termos_usados: termos,
                documentos_disponiveis: await listarDisponiveis(),
              };
            }

            return {
              total: rows.length,
              termos_usados: termos,
              documentos: montar(rows, termos[0] ?? ""),
            };
          },
        });



        try {
          const gateway = createLovableAiGatewayProvider(apiKey);
          const result = await generateText({
            model: gateway("google/gemini-2.5-flash"),
            system: SYSTEM_PROMPT,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            tools: { buscar_imoveis: buscarImoveis, buscar_documentos: buscarDocumentos },
            stopWhen: stepCountIs(5),
          });

          type FotoLite = { caminho_arquivo: string | null; ordem: number | null; id?: number };
          type ImovelRow = {
            id: string | number;
            tipo: string | null;
            bairro: string | null;
            cidade: string | null;
            estado: string | null;
            valor: number | null;
            area_m2: number | null;
            quartos: number | null;
            status_documentacao: string | null;
            descricao: string | null;
            imovel_fotos?: FotoLite[] | null;
            foto?: string | null;
          };
          const imoveis: ImovelRow[] = [];
          const seen = new Set<string>();
          for (const step of (result.steps ?? []) as Array<{
            toolResults?: Array<{ toolName?: string; output?: unknown; result?: unknown }>;
          }>) {
            for (const tr of step.toolResults ?? []) {
              if (tr.toolName !== "buscar_imoveis") continue;
              const output = (tr.output ?? tr.result) as { imoveis?: ImovelRow[] } | undefined;
              for (const im of output?.imoveis ?? []) {
                const key = String(im.id);
                if (seen.has(key)) continue;
                seen.add(key);
                const fotos = [...(im.imovel_fotos ?? [])]
                  .filter((f) => !!f.caminho_arquivo)
                  .sort(
                    (a, b) =>
                      (a.ordem ?? 9999) - (b.ordem ?? 9999) || (a.id ?? 0) - (b.id ?? 0),
                  );
                const { imovel_fotos: _drop, ...rest } = im;
                imoveis.push({ ...rest, foto: fotos[0]?.caminho_arquivo ?? null });
              }
            }
          }
          return Response.json({ text: result.text, imoveis });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const status = /429|rate/i.test(msg) ? 429 : /402|credit/i.test(msg) ? 402 : 500;
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
