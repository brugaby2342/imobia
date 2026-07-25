import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Plus, List } from "lucide-react";
import { toast } from "sonner";
import { createImovel } from "@/lib/imoveis.functions";
import { ImovelFormView, emptyForm, formToPayload, type ImovelForm } from "@/components/ImovelForm";
import { FotosImovel } from "@/components/MidiaImovel";

export const Route = createFileRoute("/_authenticated/imoveis/novo")({
  component: NovoImovel,
});

type Criado = { id: number; titulo: string };

function NovoImovel() {
  const create = useServerFn(createImovel);
  const [submitting, setSubmitting] = useState(false);
  const [criado, setCriado] = useState<Criado | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function onSubmit(form: ImovelForm) {
    const parsed = formToPayload(form);
    if (parsed.errs.length || !parsed.payload) return;
    setSubmitting(true);
    try {
      const row = await create({ data: parsed.payload });
      const titulo = [parsed.payload.tipo, parsed.payload.bairro, parsed.payload.cidade]
        .filter(Boolean)
        .join(" · ");
      setCriado({ id: Number(row.id), titulo });
      toast.success(`Imóvel #${row.id} cadastrado com sucesso.`);
    } catch (e) {
      toast.error(`Falha ao criar imóvel: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  function cadastrarOutro() {
    setCriado(null);
    setFormKey((k) => k + 1);
  }

  if (criado) {
    return (
      <div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <h2 className="text-base font-semibold text-emerald-900">
                Imóvel #{criado.id} cadastrado com sucesso
              </h2>
              <p className="mt-1 text-sm text-emerald-800">
                {criado.titulo || "Imóvel"} — agora envie as fotos como segunda etapa do cadastro.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={cadastrarOutro}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-blue-600 to-blue-800 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:brightness-110"
            >
              <Plus className="h-3.5 w-3.5" />
              Cadastrar outro imóvel
            </button>
            <Link
              to="/imoveis"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <List className="h-3.5 w-3.5" />
              Voltar à listagem
            </Link>
          </div>
        </div>

        <FotosImovel imovelId={criado.id} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Novo imóvel</h2>
      <ImovelFormView
        key={formKey}
        initial={emptyForm}
        submitting={submitting}
        onSubmit={onSubmit}
        submitLabel="Cadastrar"
      />
      <p className="mt-4 text-xs text-slate-500">
        As fotos poderão ser enviadas logo após salvar, na etapa seguinte.
      </p>
    </div>
  );
}
