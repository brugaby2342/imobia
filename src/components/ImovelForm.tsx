import { useState, type FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { listStatusDocumentacao } from "@/lib/imoveis.functions";

export type ImovelForm = {
  tipo: string;
  bairro: string;
  cidade: string;
  estado: string;
  valor: string;
  area_m2: string;
  quartos: string;
  status_documentacao: string;
  descricao: string;
};

export const emptyForm: ImovelForm = {
  tipo: "",
  bairro: "",
  cidade: "",
  estado: "",
  valor: "",
  area_m2: "",
  quartos: "",
  status_documentacao: "",
  descricao: "",
};

export function formToPayload(f: ImovelForm) {
  const errs: string[] = [];
  if (!f.tipo.trim()) errs.push("Tipo é obrigatório");
  if (!f.cidade.trim()) errs.push("Cidade é obrigatória");
  if (!f.estado.trim()) errs.push("Estado é obrigatório");
  const valorNum = Number(f.valor.replace(/\./g, "").replace(",", "."));
  if (!f.valor.trim() || !Number.isFinite(valorNum) || valorNum < 0)
    errs.push("Valor é obrigatório e deve ser positivo");
  const areaNum = f.area_m2.trim() ? Number(f.area_m2.replace(",", ".")) : null;
  if (areaNum != null && (!Number.isFinite(areaNum) || areaNum < 0))
    errs.push("Área inválida");
  const quartosNum = f.quartos.trim() ? Number(f.quartos) : null;
  if (quartosNum != null && (!Number.isInteger(quartosNum) || quartosNum < 0))
    errs.push("Quartos deve ser inteiro não-negativo");
  if (errs.length) return { errs };
  return {
    payload: {
      tipo: f.tipo.trim(),
      bairro: f.bairro.trim() || null,
      cidade: f.cidade.trim(),
      estado: f.estado.trim(),
      valor: valorNum,
      area_m2: areaNum,
      quartos: quartosNum,
      status_documentacao: f.status_documentacao.trim() || null,
      descricao: f.descricao.trim() || null,
    },
    errs: [] as string[],
  };
}

export function ImovelFormView({
  initial,
  submitting,
  onSubmit,
  submitLabel,
}: {
  initial: ImovelForm;
  submitting: boolean;
  onSubmit: (f: ImovelForm) => Promise<void> | void;
  submitLabel: string;
}) {
  const [form, setForm] = useState<ImovelForm>(initial);
  const [localErrs, setLocalErrs] = useState<string[]>([]);
  const listStatus = useServerFn(listStatusDocumentacao);
  const { data: statusOptions } = useQuery({
    queryKey: ["status-documentacao"],
    queryFn: () => listStatus(),
    staleTime: 30_000,
  });

  const upd =
    <K extends keyof ImovelForm>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((s) => ({ ...s, [k]: e.target.value }));

  async function handle(e: FormEvent) {
    e.preventDefault();
    const parsed = formToPayload(form);
    if (parsed.errs.length) {
      setLocalErrs(parsed.errs);
      return;
    }
    setLocalErrs([]);
    await onSubmit(form);
  }

  const inp =
    "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  const lbl = "mb-1 block text-xs font-medium text-slate-700";

  return (
    <form
      onSubmit={handle}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {localErrs.length > 0 && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <ul className="list-inside list-disc space-y-0.5">
            {localErrs.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label className={lbl}>
            Tipo <span className="text-red-600">*</span>
          </label>
          <input
            className={inp}
            value={form.tipo}
            onChange={upd("tipo")}
            placeholder="Ex: Apartamento, Casa, Terreno"
            required
          />
        </div>
        <div>
          <label className={lbl}>Bairro</label>
          <input
            className={inp}
            value={form.bairro}
            onChange={upd("bairro")}
            placeholder="Ex: Centro"
          />
        </div>
        <div>
          <label className={lbl}>
            Cidade <span className="text-red-600">*</span>
          </label>
          <input
            className={inp}
            value={form.cidade}
            onChange={upd("cidade")}
            placeholder="Ex: Balneário Camboriú"
            required
          />
        </div>
        <div>
          <label className={lbl}>
            Estado <span className="text-red-600">*</span>
          </label>
          <input
            className={inp}
            value={form.estado}
            onChange={upd("estado")}
            placeholder="Ex: SC"
            required
          />
        </div>
        <div>
          <label className={lbl}>
            Valor (R$) <span className="text-red-600">*</span>
          </label>
          <input
            className={inp}
            value={form.valor}
            onChange={upd("valor")}
            placeholder="Ex: 850000"
            inputMode="decimal"
            required
          />
        </div>
        <div>
          <label className={lbl}>Área (m²)</label>
          <input
            className={inp}
            value={form.area_m2}
            onChange={upd("area_m2")}
            placeholder="Ex: 120"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className={lbl}>Quartos</label>
          <input
            className={inp}
            value={form.quartos}
            onChange={upd("quartos")}
            placeholder="Ex: 3"
            inputMode="numeric"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Situação documental</label>
          <input
            className={inp}
            list="status-documentacao-sug"
            value={form.status_documentacao}
            onChange={upd("status_documentacao")}
            placeholder="Ex: Documentação em dia"
          />
          <datalist id="status-documentacao-sug">
            {(statusOptions ?? []).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <p className="mt-1 text-[11px] text-slate-500">
            Sugestões vêm dos valores já cadastrados. Use o mesmo texto para evitar divergência
            de grafia.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Descrição</label>
          <textarea
            className={`${inp} min-h-[100px] resize-y`}
            value={form.descricao}
            onChange={upd("descricao")}
            placeholder="Detalhes comerciais do imóvel"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Link
          to="/imoveis"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-blue-600 to-blue-800 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function useRouterInstance() {
  return useRouter();
}
