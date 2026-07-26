import { supabase } from "@/integrations/supabase/client";

export type RemoveOutcome = {
  /** Caminhos efetivamente apagados do bucket. */
  removed: string[];
  /** Caminhos que o Storage não encontrou (não existiam no bucket). */
  missing: string[];
};

/**
 * Remove objetos do Storage e distingue "apagado" de "não existia".
 *
 * A API `storage.remove()` NÃO retorna erro quando o caminho não existe:
 * ela simplesmente omite o arquivo da lista `data`. Por isso comparamos
 * os caminhos pedidos com os caminhos retornados para detectar divergência
 * entre `caminho_arquivo` no banco e o objeto real no bucket.
 */
export async function removeFromStorage(
  bucket: string,
  paths: string[],
): Promise<RemoveOutcome> {
  const wanted = paths.filter(Boolean);
  if (wanted.length === 0) return { removed: [], missing: [] };

  const { data, error } = await supabase.storage.from(bucket).remove(wanted);
  if (error) throw new Error(error.message);

  const removedNames = new Set(
    (data ?? []).map((o) => (o as { name: string }).name).filter(Boolean),
  );
  const removed = wanted.filter((p) => removedNames.has(p));
  const missing = wanted.filter((p) => !removedNames.has(p));
  return { removed, missing };
}
