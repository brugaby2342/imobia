import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { ImovelModal, type ImovelDetalhe } from "@/components/ImovelModal";
import { supabase } from "@/integrations/supabase/client";
import { removeFromStorageStrict } from "@/lib/storage-remove";
import { listImoveis, deleteImovel } from "@/lib/imoveis.functions";


export const Route = createFileRoute("/_authenticated/imoveis/")({
  component: ListaImoveis,
});

const brl = (v: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(v);

function ListaImoveis() {
  const router = useRouter();
  const routeCtx = Route.useRouteContext() as { role?: string };
  const isAdmin = routeCtx.role === "admin";
  const list = useServerFn(listImoveis);
  const del = useServerFn(deleteImovel);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["imoveis-admin"],
    queryFn: () => list(),
  });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedImovel, setSelectedImovel] = useState<ImovelDetalhe | null>(null);

  async function onDelete(id: number, label: string) {
    if (
      !confirm(
        `Excluir "${label}"? As fotos do imóvel também serão excluídas. Documentos vinculados são mantidos, apenas sem vínculo. Esta ação não pode ser desfeita.`,
      )
    )
      return;
    setDeletingId(id);
    try {
      // 1) Apaga os arquivos de foto no Storage antes do cascade do banco.
      const { data: fotos, error: fotosErr } = await supabase
        .from("imovel_fotos")
        .select("caminho_arquivo")
        .eq("imovel_id", id);
      if (fotosErr) throw new Error(fotosErr.message);

      const paths = (fotos ?? []).map((f) => f.caminho_arquivo).filter(Boolean);
      if (paths.length) {
        // Resposta vazia do Storage não é "arquivo inexistente": aborta a exclusão.
        await removeFromStorageStrict("imovel_fotos", paths);
      }

      // 2) Exclui o imóvel (fotos em cascata; documentos ficam sem vínculo).
      try {
        await del({ data: { id } });
      } catch (e) {
        toast.error(
          paths.length
            ? `Arquivos de foto já removidos do Storage, mas o imóvel #${id} NÃO foi excluído: ${(e as Error).message}. As fotos restantes apontam para arquivos inexistentes — tente excluir novamente.`
            : `Falha ao excluir imóvel #${id}: ${(e as Error).message}`,
        );
        await refetch();
        return;
      }


      await refetch();
      router.invalidate();
      toast.success(`Imóvel #${id} excluído.`);
    } catch (e) {
      toast.error(`Falha ao excluir: ${(e as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  }


  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          {data ? `${data.length} imóvel(is) cadastrado(s)` : "Carregando..."}
        </p>
        {isAdmin && (
          <Link
            to="/imoveis/novo"
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-blue-600 to-blue-800 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:brightness-110"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo imóvel
          </Link>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando imóveis...
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Erro ao carregar: {(error as Error).message}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nenhum imóvel cadastrado ainda.
        </div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Tipo / Bairro</th>
                <th className="px-4 py-2.5 font-medium">Cidade / UF</th>
                <th className="px-4 py-2.5 font-medium">Valor</th>
                <th className="px-4 py-2.5 font-medium">Área</th>
                <th className="px-4 py-2.5 font-medium">Quartos</th>
                <th className="px-4 py-2.5 font-medium">Situação documental</th>
                {isAdmin && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {data.map((im) => (
                <tr
                  key={im.id}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                  onClick={() => setSelectedImovel(im as ImovelDetalhe)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{im.tipo}</div>
                    {im.bairro && <div className="text-xs text-slate-500">{im.bairro}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {im.cidade} / {im.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-blue-800">{brl(im.valor)}</td>
                  <td className="px-4 py-3 text-slate-700">{im.area_m2 != null ? `${im.area_m2} m²` : "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{im.quartos ?? "—"}</td>
                  <td className="px-4 py-3 max-w-[220px] truncate text-xs text-slate-500">
                    {im.status_documentacao ?? "—"}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to="/imoveis/$id"
                          params={{ id: String(im.id) }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                          aria-label="Editar"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(im.id, `${im.tipo}${im.bairro ? " · " + im.bairro : ""}`);
                          }}
                          disabled={deletingId === im.id}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                          aria-label="Excluir"
                        >
                          {deletingId === im.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedImovel && (
        <ImovelModal imovel={selectedImovel} onClose={() => setSelectedImovel(null)} />
      )}
    </div>
  );
}
