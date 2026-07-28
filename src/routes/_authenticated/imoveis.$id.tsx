import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, List } from "lucide-react";

import { toast } from "sonner";
import { getImovel, updateImovel } from "@/lib/imoveis.functions";
import {
  ImovelFormView,
  emptyForm,
  formToPayload,
  type ImovelForm,
} from "@/components/ImovelForm";
import { FotosImovel, DocumentosImovel } from "@/components/MidiaImovel";

export const Route = createFileRoute("/_authenticated/imoveis/$id")({
  component: EditarImovel,
});

function EditarImovel() {
  const { id } = Route.useParams();
  const numericId = Number(id);
  const navigate = useNavigate();
  const get = useServerFn(getImovel);
  const update = useServerFn(updateImovel);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["imovel", numericId],
    queryFn: () => get({ data: { id: numericId } }),
    enabled: Number.isFinite(numericId),
  });

  async function onSubmit(form: ImovelForm) {
    const parsed = formToPayload(form);
    if (parsed.errs.length || !parsed.payload) return;
    setSubmitting(true);
    try {
      await update({ data: { id: numericId, ...parsed.payload } });
      toast.success(`Imóvel #${numericId} atualizado com sucesso.`);
      navigate({ to: "/imoveis" });
    } catch (e) {
      toast.error(`Falha ao salvar: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando imóvel...
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error ? (error as Error).message : "Imóvel não encontrado"}
      </div>
    );
  }

  const initial: ImovelForm = {
    ...emptyForm,
    tipo: data.tipo ?? "",
    bairro: data.bairro ?? "",
    cidade: data.cidade ?? "",
    estado: data.estado ?? "",
    valor: data.valor != null ? String(data.valor) : "",
    area_m2: data.area_m2 != null ? String(data.area_m2) : "",
    quartos: data.quartos != null ? String(data.quartos) : "",
    status_documentacao: data.status_documentacao ?? "",
    descricao: data.descricao ?? "",
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Editar imóvel</h2>
      <ImovelFormView
        initial={initial}
        submitting={submitting}
        onSubmit={onSubmit}
        submitLabel="Salvar alterações"
      />
      <FotosImovel imovelId={numericId} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/imoveis/novo"
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-blue-600 to-blue-800 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:brightness-110"
        >
          <Plus className="h-3.5 w-3.5" />
          Cadastrar outro imóvel
        </Link>
        <Link
          to="/imoveis"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <List className="h-3.5 w-3.5" />
          Voltar à listagem
        </Link>
      </div>
      <DocumentosImovel imovelId={numericId} />
    </div>

  );
}
