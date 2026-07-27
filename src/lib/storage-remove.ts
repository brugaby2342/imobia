import { supabase } from "@/integrations/supabase/client";

export type RemoveOutcome = {
  /** Caminhos que o Storage confirmou ter apagado. */
  removed: string[];
  /**
   * Caminhos SEM confirmação de remoção.
   *
   * Atenção: NÃO significa "arquivo inexistente". A API `storage.remove()`
   * também devolve `data` vazio, sem erro, quando o objeto não é visível para
   * o usuário (ex.: falta de política de SELECT em `storage.objects`). Por
   * isso o chamador deve tratar isso como FALHA e não excluir a linha do
   * banco — caso contrário sobra arquivo órfão no bucket.
   */
  unresolved: string[];
};

export async function removeFromStorage(
  bucket: string,
  paths: string[],
): Promise<RemoveOutcome> {
  const wanted = paths.filter(Boolean);
  if (wanted.length === 0) return { removed: [], unresolved: [] };

  const { data, error } = await supabase.storage.from(bucket).remove(wanted);
  if (error) throw new Error(error.message);

  const removedNames = new Set(
    (data ?? []).map((o) => (o as { name: string }).name).filter(Boolean),
  );
  const removed = wanted.filter((p) => removedNames.has(p));
  const unresolved = wanted.filter((p) => !removedNames.has(p));
  return { removed, unresolved };
}

/**
 * Remove e EXIGE confirmação do Storage para todos os caminhos.
 * Lança erro quando algum caminho não é confirmado.
 */
export async function removeFromStorageStrict(bucket: string, paths: string[]): Promise<void> {
  const out = await removeFromStorage(bucket, paths);
  if (out.unresolved.length) {
    throw new Error(
      `O Storage não confirmou a remoção de ${out.unresolved.length} arquivo(s) no bucket "${bucket}" (ex.: ${out.unresolved[0]}). ` +
        `A resposta veio vazia, o que pode indicar arquivo inacessível ou permissão insuficiente — o registro no banco foi mantido.`,
    );
  }
}
