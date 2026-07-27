/**
 * Ordem canônica das fotos de um imóvel.
 *
 * O nome do arquivo segue o padrão `imovel_{id 3 dígitos}_{sequencial}.{ext}`.
 * A ordem estável é: coluna `ordem` (quando preenchida), depois o sequencial
 * extraído do nome do arquivo e, por fim, o id. A primeira foto é a capa.
 */
export type FotoLike = {
  id?: number | null;
  caminho_arquivo: string | null;
  ordem?: number | null;
};

export function seqFromPath(path: string | null | undefined): number {
  if (!path) return Number.MAX_SAFE_INTEGER;
  const base = path.split("/").pop() ?? path;
  const m = base.match(/^imovel_\d+_(\d+)\./i);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

export function sortFotos<T extends FotoLike>(fotos: T[]): T[] {
  return [...fotos]
    .filter((f) => !!f.caminho_arquivo)
    .sort(
      (a, b) =>
        (a.ordem ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? Number.MAX_SAFE_INTEGER) ||
        seqFromPath(a.caminho_arquivo) - seqFromPath(b.caminho_arquivo) ||
        (a.id ?? 0) - (b.id ?? 0),
    );
}
