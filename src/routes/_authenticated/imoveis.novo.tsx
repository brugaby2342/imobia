import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createImovel } from "@/lib/imoveis.functions";
import { ImovelFormView, emptyForm, formToPayload, type ImovelForm } from "@/components/ImovelForm";

export const Route = createFileRoute("/_authenticated/imoveis/novo")({
  component: NovoImovel,
});

function NovoImovel() {
  const navigate = useNavigate();
  const create = useServerFn(createImovel);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(form: ImovelForm) {
    const parsed = formToPayload(form);
    if (parsed.errs.length || !parsed.payload) return;
    setSubmitting(true);
    try {
      await create({ data: parsed.payload });
      navigate({ to: "/imoveis" });
    } catch (e) {
      alert(`Falha ao criar: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Novo imóvel</h2>
      <ImovelFormView
        initial={emptyForm}
        submitting={submitting}
        onSubmit={onSubmit}
        submitLabel="Cadastrar"
      />
      <p className="mt-4 text-xs text-slate-500">
        Fotos e documentos podem ser enviados após salvar o imóvel, na tela de edição.
      </p>
    </div>
  );
}
