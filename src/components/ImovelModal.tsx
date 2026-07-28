import { useCallback, useEffect, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
  MapPin,
  Ruler,
  BedDouble,
  FileCheck2,
  FileText,
  Download,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sortFotos } from "@/lib/foto-order";

const FOTOS_BUCKET = "imovel_fotos";
const DOCS_BUCKET = "documentos";

export type ImovelDetalhe = {
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
  foto?: string | null;
};

type FotoRow = { id: number; caminho_arquivo: string; ordem: number | null };
type DocRow = { id: number; titulo: string; categoria: string; caminho_arquivo: string };

const brl = (v: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(v);

const plural = (n: number, singular: string, pluralForm = `${singular}s`) =>
  `${n} ${n === 1 ? singular : pluralForm}`;

export function ImovelModal({
  imovel,
  onClose,
}: {
  imovel: ImovelDetalhe;
  onClose: () => void;
}) {
  const numericId = Number(imovel.id);
  const [fotos, setFotos] = useState<string[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [f, d] = await Promise.all([
        supabase
          .from("imovel_fotos")
          .select("id,caminho_arquivo,ordem")
          .eq("imovel_id", numericId),
        supabase
          .from("documentos")
          .select("id,titulo,categoria,caminho_arquivo")
          .eq("imovel_id", numericId)
          .order("id", { ascending: false }),
      ]);
      if (!alive) return;
      const ordered = sortFotos((f.data ?? []) as FotoRow[]).map((x) => x.caminho_arquivo);
      const paths = ordered.length ? ordered : imovel.foto ? [imovel.foto] : [];
      setFotos(paths);
      setDocs((d.data ?? []) as DocRow[]);
      setIdx(0);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [numericId, imovel.foto]);

  const prev = useCallback(
    () => setIdx((i) => (fotos.length ? (i - 1 + fotos.length) % fotos.length : 0)),
    [fotos.length],
  );
  const next = useCallback(
    () => setIdx((i) => (fotos.length ? (i + 1) % fotos.length : 0)),
    [fotos.length],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next]);

  async function baixar(row: DocRow) {
    const { data } = await supabase.storage
      .from(DOCS_BUCKET)
      .createSignedUrl(row.caminho_arquivo, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  const fotoUrl = (p: string) =>
    supabase.storage.from(FOTOS_BUCKET).getPublicUrl(p).data.publicUrl;

  const titulo = `${imovel.tipo ?? "Imóvel"}${imovel.bairro ? ` · ${imovel.bairro}` : ""}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="overflow-y-auto">
          {/* Galeria */}
          <div className="relative aspect-[16/10] w-full bg-slate-100">
            {loading ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : fotos.length > 0 ? (
              <>
                <img
                  src={fotoUrl(fotos[idx])}
                  alt={`Foto ${idx + 1} do imóvel ${imovel.tipo ?? ""} em ${imovel.cidade ?? ""}`}
                  className="h-full w-full object-cover"
                />
                {fotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prev}
                      aria-label="Foto anterior"
                      className="absolute left-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      aria-label="Próxima foto"
                      className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-900/60 px-2.5 py-1">
                      {fotos.map((p, i) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setIdx(i)}
                          aria-label={`Ir para foto ${i + 1}`}
                          className={`h-1.5 rounded-full transition-all ${
                            i === idx ? "w-4 bg-white" : "w-1.5 bg-white/50"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
                <Building2 className="h-8 w-8" />
                <span className="text-xs">Sem foto</span>
              </div>
            )}
          </div>

          {/* Informações */}
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
                <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {[imovel.cidade, imovel.estado].filter(Boolean).join(" / ") ||
                    "Localização não informada"}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 px-3 py-1.5 text-base font-semibold text-blue-800">
                {brl(imovel.valor)}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <Ruler className="h-4 w-4 text-slate-400" />
                {imovel.area_m2 != null ? `${imovel.area_m2} m²` : "Área não informada"}
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <BedDouble className="h-4 w-4 text-slate-400" />
                {imovel.quartos != null ? plural(imovel.quartos, "quarto") : "—"}
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <FileCheck2 className="h-4 w-4 text-slate-400" />
                <span className="truncate">{imovel.status_documentacao ?? "Situação não informada"}</span>
              </div>
            </div>

            {imovel.descricao && (
              <div className="mt-5">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Descrição
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {imovel.descricao}
                </p>
              </div>
            )}

            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Documentos vinculados
              </h3>
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...
                </div>
              ) : docs.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum documento vinculado a este imóvel.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <div className="truncate text-sm text-slate-800">{d.titulo}</div>
                          <div className="truncate text-[11px] text-slate-500">{d.categoria}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => baixar(d)}
                        aria-label={`Baixar ${d.titulo}`}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
