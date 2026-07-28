import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Upload,
  Trash2,
  FileText,
  Download,
  X,
  FilePlus2,
  CheckCircle2,
  Plus,
  Pencil,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { removeFromStorageStrict } from "@/lib/storage-remove";
import { listImoveis } from "@/lib/imoveis.functions";


const DOCS_BUCKET = "documentos";
const MAX_BYTES = 5 * 1024 * 1024;
const DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

type DocRow = {
  id: number;
  titulo: string;
  categoria: string;
  descricao: string | null;
  caminho_arquivo: string;
  imovel_id: number | null;
  conteudo_text: string | null;
};

type ImovelLite = { id: number; tipo: string; bairro: string | null; cidade: string };

export const Route = createFileRoute("/_authenticated/documentos/")({
  component: DocumentosPage,
});

/** Decodifica percent-encoding (ex: "%20") ANTES de sanitizar, para não virar "_20". */
function safeDecode(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function sanitizeBase(rawName: string): { base: string; ext: string } {
  const name = safeDecode(rawName);
  const dot = name.lastIndexOf(".");
  const rawExt = dot >= 0 ? name.slice(dot + 1) : "";
  const rawBase = dot >= 0 ? name.slice(0, dot) : name;
  const base = rawBase
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "documento";
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return { base, ext };
}

async function uploadWithCollision(file: File): Promise<string> {
  const { base, ext } = sanitizeBase(file.name);
  let attempt = 0;
  // Tenta base.ext, depois base_2.ext, base_3.ext...
  while (true) {
    attempt += 1;
    const suffix = attempt === 1 ? "" : `_${attempt}`;
    const path = `${base}${suffix}.${ext}`;
    const { error } = await supabase.storage
      .from(DOCS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (!error) return path;
    const msg = error.message.toLowerCase();
    if (!msg.includes("exists") && !msg.includes("duplicate")) {
      throw new Error(error.message);
    }
    if (attempt > 200) throw new Error("Não foi possível gerar nome único para o arquivo.");
  }
}

type Pending = {
  file: File;
  titulo: string;
  conteudo: string;
};

type Criado = { id: number; titulo: string };

function DocumentosPage() {
  const list = useServerFn(listImoveis);
  const { data: imoveis } = useQuery({
    queryKey: ["imoveis-lite"],
    queryFn: () => list(),
  });

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [pending, setPending] = useState<Pending[]>([]);
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [imovelId, setImovelId] = useState<string>("");
  const [filtroImovel, setFiltroImovel] = useState<string>("todos");
  const [sucesso, setSucesso] = useState<Criado[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLElement>(null);

  async function load() {
    setLoadingDocs(true);
    const { data, error } = await supabase
      .from("documentos")
      .select("id,titulo,categoria,descricao,caminho_arquivo,imovel_id,conteudo_text")
      .order("id", { ascending: false });
    if (error) setErr(error.message);
    else setDocs(data ?? []);
    setLoadingDocs(false);
  }

  useEffect(() => {
    load();
  }, []);

  const imoveisMap = useMemo(() => {
    const m = new Map<number, ImovelLite>();
    for (const im of (imoveis ?? []) as ImovelLite[]) m.set(im.id, im);
    return m;
  }, [imoveis]);

  function addFiles(files: FileList) {
    setErr(null);
    const next: Pending[] = [];
    for (const file of Array.from(files)) {
      const okType = DOC_TYPES.includes(file.type) || /\.(pdf|docx)$/i.test(file.name);
      if (!okType) {
        setErr(`Formato não suportado: ${file.name} (use PDF ou DOCX).`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setErr(`${file.name} excede 5 MB.`);
        continue;
      }
      const decoded = safeDecode(file.name);
      const dot = decoded.lastIndexOf(".");
      const defaultTitle = (dot >= 0 ? decoded.slice(0, dot) : decoded).replace(/[_-]+/g, " ").trim();
      next.push({ file, titulo: defaultTitle, conteudo: "" });
    }
    if (next.length) setPending((p) => [...p, ...next]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function updateTitulo(idx: number, value: string) {
    setPending((prev) => prev.map((p, i) => (i === idx ? { ...p, titulo: value } : p)));
  }
  function updateConteudo(idx: number, value: string) {
    setPending((prev) => prev.map((p, i) => (i === idx ? { ...p, conteudo: value } : p)));
  }
  function removePending(idx: number) {
    setPending((prev) => prev.filter((_, i) => i !== idx));
  }

  async function enviar() {
    setErr(null);
    if (!pending.length) return;
    if (!categoria.trim()) {
      setErr("Informe a categoria antes de enviar.");
      toast.error("Informe a categoria antes de enviar.");
      return;
    }
    if (pending.some((p) => !p.titulo.trim())) {
      setErr("Todos os arquivos precisam de um título.");
      toast.error("Todos os arquivos precisam de um título.");
      return;
    }
    setUploading(true);
    const link = imovelId ? Number(imovelId) : null;
    const criados: Criado[] = [];
    try {
      for (const p of pending) {
        const path = await uploadWithCollision(p.file);
        const { data: inserted, error: insErr } = await supabase
          .from("documentos")
          .insert({
            titulo: p.titulo.trim(),
            categoria: categoria.trim(),
            descricao: descricao.trim() || null,
            caminho_arquivo: path,
            imovel_id: link,
            conteudo_text: p.conteudo.trim() || null,
          })
          .select("id,titulo")
          .single();
        if (insErr) {
          await supabase.storage.from(DOCS_BUCKET).remove([path]);
          throw new Error(insErr.message);
        }
        criados.push({ id: inserted.id, titulo: inserted.titulo });
      }
      setPending([]);
      setDescricao("");
      setSucesso(criados);
      await load();
      toast.success(
        criados.length === 1
          ? `Documento #${criados[0].id} enviado com sucesso.`
          : `${criados.length} documentos enviados com sucesso.`,
      );
    } catch (e) {
      setErr((e as Error).message);
      toast.error(`Falha ao enviar documento: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  function cadastrarOutro() {
    setSucesso(null);
    setErr(null);
    setPending([]);
    setCategoria("");
    setDescricao("");
    setImovelId("");
  }

  async function abrir(row: DocRow) {
    const { data, error } = await supabase.storage
      .from(DOCS_BUCKET)
      .createSignedUrl(row.caminho_arquivo, 60);
    if (error) {
      setErr(error.message);
      toast.error(`Falha ao abrir documento: ${error.message}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(row: DocRow) {
    if (!confirm(`Remover "${row.titulo}"?`)) return;
    setErr(null);

    // 1) Storage primeiro. Resposta vazia não é prova de "arquivo inexistente":
    //    mantemos o registro no banco para não deixar arquivo órfão.
    try {
      await removeFromStorageStrict(DOCS_BUCKET, [row.caminho_arquivo]);
    } catch (e) {
      const msg = (e as Error).message;
      setErr(msg);
      toast.error(`Falha ao remover o arquivo do Storage: ${msg}`);
      return;
    }

    // 2) Banco.
    const { error: delErr } = await supabase.from("documentos").delete().eq("id", row.id);
    if (delErr) {
      setErr(delErr.message);
      toast.error(
        `Arquivo removido do Storage, mas o registro #${row.id} NÃO foi excluído: ${delErr.message}. O documento agora aponta para um arquivo inexistente — tente excluir novamente.`,
      );
      await load();
      return;
    }
    await load();
    toast.success("Documento removido.");
  }



  const filteredDocs = useMemo(() => {
    if (filtroImovel === "todos") return docs;
    if (filtroImovel === "geral") return docs.filter((d) => d.imovel_id == null);
    const id = Number(filtroImovel);
    return docs.filter((d) => d.imovel_id === id);
  }, [docs, filtroImovel]);

  const inp =
    "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  const lbl = "mb-1 block text-xs font-medium text-slate-700";

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Documentos</h2>

      {sucesso ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <h3 className="text-base font-semibold text-emerald-900">
                {sucesso.length === 1
                  ? "Documento cadastrado com sucesso"
                  : `${sucesso.length} documentos cadastrados com sucesso`}
              </h3>
              <ul className="mt-1 list-inside list-disc text-sm text-emerald-800">
                {sucesso.map((d) => (
                  <li key={d.id}>
                    #{d.id} · {d.titulo}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={cadastrarOutro}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-blue-600 to-blue-800 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:brightness-110"
            >
              <Plus className="h-3.5 w-3.5" />
              Cadastrar outro documento
            </button>
          </div>
        </section>
      ) : (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <FilePlus2 className="h-4 w-4 text-blue-700" />
          <h3 className="text-sm font-semibold text-slate-900">Enviar documentos</h3>
        </div>


        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={lbl}>Categoria *</label>
            <input
              className={inp}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Matrícula, Contrato, Manual"
            />
          </div>
          <div>
            <label className={lbl}>Vincular a imóvel (opcional)</label>
            <select
              className={inp}
              value={imovelId}
              onChange={(e) => setImovelId(e.target.value)}
            >
              <option value="">Documento geral</option>
              {(imoveis ?? []).map((im) => {
                const i = im as ImovelLite;
                return (
                  <option key={i.id} value={String(i.id)}>
                    #{i.id} · {i.tipo} — {i.bairro ? `${i.bairro}, ` : ""}
                    {i.cidade}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className={lbl}>Descrição (opcional)</label>
            <input
              className={inp}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Observações"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
            <FileText className="h-3.5 w-3.5" />
            Selecionar arquivos
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              disabled={uploading}
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </label>
          <button
            type="button"
            disabled={uploading || pending.length === 0}
            onClick={enviar}
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-blue-600 to-blue-800 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Enviar {pending.length > 0 ? `(${pending.length})` : ""}
          </button>
          <span className="text-[11px] text-slate-500">
            PDF ou DOCX · até 5 MB por arquivo.
          </span>
        </div>

        {err && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {err}
          </div>
        )}

        {pending.length > 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-3">
            <div className="mb-2 text-xs font-medium text-slate-700">
              Pré-visualização ({pending.length})
            </div>
            <ul className="space-y-2">
              {pending.map((p, idx) => (
                <li
                  key={idx}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <input
                      className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      value={p.titulo}
                      onChange={(e) => updateTitulo(idx, e.target.value)}
                      placeholder="Título do documento"
                    />
                    <span className="hidden truncate text-[11px] text-slate-500 sm:inline">
                      {p.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePending(idx)}
                      disabled={uploading}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                      aria-label="Remover da fila"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-2">
                    <label className="mb-1 block text-[11px] font-medium text-slate-700">
                      Conteúdo do documento (texto consultado pela IA nas perguntas do chat)
                    </label>
                    <textarea
                      className="min-h-[90px] w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      value={p.conteudo}
                      onChange={(e) => updateConteudo(idx, e.target.value)}
                      placeholder="Cole aqui o texto do documento (opcional)"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Opcional. Sem esse texto a IA reconhece a existência do documento, mas não
                      responde sobre o conteúdo dele.
                    </p>
                  </div>
                </li>
              ))}

            </ul>
          </div>
        )}
      </section>
      )}

      <section
        ref={listaRef}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-blue-700" />
          <h3 className="text-sm font-semibold text-slate-900">
            Documentos enviados
          </h3>
          <span className="text-xs text-slate-500">({filteredDocs.length})</span>
          <div className="ml-auto">
            <select
              className={inp}
              value={filtroImovel}
              onChange={(e) => setFiltroImovel(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="geral">Apenas gerais</option>
              {(imoveis ?? []).map((im) => {
                const i = im as ImovelLite;
                return (
                  <option key={i.id} value={String(i.id)}>
                    Imóvel #{i.id}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {loadingDocs ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando documentos...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
            Nenhum documento encontrado.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {filteredDocs.map((d) => {
              const im = d.imovel_id != null ? imoveisMap.get(d.imovel_id) : null;
              const vinculo = im
                ? `Imóvel #${im.id} · ${im.tipo} — ${im.bairro ? `${im.bairro}, ` : ""}${im.cidade}`
                : d.imovel_id != null
                ? `Imóvel #${d.imovel_id}`
                : "Documento geral";
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {d.titulo}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {d.categoria} · {vinculo}
                      {d.descricao ? ` · ${d.descricao}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => abrir(d)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                      aria-label="Abrir"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(d)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-red-300 hover:text-red-700"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
