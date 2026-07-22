import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const imovelInput = z.object({
  tipo: z.string().trim().min(1).max(80),
  bairro: z.string().trim().max(120).nullish(),
  cidade: z.string().trim().min(1).max(120),
  estado: z.string().trim().min(1).max(80),
  valor: z.number().nonnegative(),
  area_m2: z.number().nonnegative().nullish(),
  quartos: z.number().int().nonnegative().nullish(),
  status_documentacao: z.string().trim().max(300).nullish(),
  descricao: z.string().trim().max(4000).nullish(),
});

const emptyToNull = <T extends z.infer<typeof imovelInput>>(v: T) => ({
  ...v,
  bairro: v.bairro?.trim() ? v.bairro.trim() : null,
  status_documentacao: v.status_documentacao?.trim() ? v.status_documentacao.trim() : null,
  descricao: v.descricao?.trim() ? v.descricao.trim() : null,
  area_m2: v.area_m2 ?? null,
  quartos: v.quartos ?? null,
});

export const listImoveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("imoveis")
      .select("id,tipo,bairro,cidade,estado,valor,area_m2,quartos,status_documentacao,descricao")
      .order("id", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getImovel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("imoveis")
      .select("id,tipo,bairro,cidade,estado,valor,area_m2,quartos,status_documentacao,descricao")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Imóvel não encontrado");
    return row;
  });

export const listStatusDocumentacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("imoveis")
      .select("status_documentacao")
      .not("status_documentacao", "is", null);
    if (error) throw new Error(error.message);
    const set = new Set<string>();
    for (const row of data ?? []) {
      const s = (row.status_documentacao ?? "").trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  });

export const createImovel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => imovelInput.parse(d))
  .handler(async ({ context, data }) => {
    const payload = emptyToNull(data);
    const { data: row, error } = await context.supabase
      .from("imoveis")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateImovel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.number().int() }).merge(imovelInput).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    const payload = emptyToNull(rest);
    const { error } = await context.supabase.from("imoveis").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  });

export const deleteImovel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("imoveis").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
