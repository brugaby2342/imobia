import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, Trash2, ImageIcon, FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const FOTOS_BUCKET = "imovel_fotos";
const DOCS_BUCKET = "documentos";
const MAX_BYTES = 5 * 1024 * 1024;
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

type FotoRow = { id: number; caminho_arquivo: string; ordem: number | null };
type DocRow = {
  id: number;
  titulo: string;
  categoria: string;
  descricao: string | null;
  caminho_arquivo: string;
  imovel_id: number | null;
};

function extFromName(name: string) {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "bin";
}

export function FotosImovel({ imovelId }: { imovelId: number }) {
  const [fotos, setFotos] = useState<FotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("imovel_fotos")
      .select("id,caminho_arquivo,ordem")
      .eq("imovel_id", imovelId)
      .order("ordem", { ascending: true })
      .order("id", { ascending: true });
    if (error) setErr(error.message);
    else setFotos(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imovelId]);

  async function handleFiles(files: FileList) {
    setErr(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!IMG_TYPES.includes(file.type)) {
          throw new Error(`Formato não suportado: ${file.name} (use JPG, PNG ou WebP).`);
        }
        if (file.size > MAX_BYTES) {
          throw new Error(`${file.name} excede 5 MB.`);
        }
        const path = `${imovelId}/${crypto.randomUUID()}.${extFromName(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from(FOTOS_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { error: insErr } = await supabase
          .from("imovel_fotos")
          .insert({ imovel_id: imovelId, caminho_arquivo: path, ordem: fotos.length + 1 });
        if (insErr) {
          await supabase.storage.from(FOTOS_BUCKET).remove([path]);
          throw new Error(insErr.message);
        }
      }
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(row: FotoRow) {
    if (!confirm("Remover esta foto?")) return;
    setErr(null);
    const { error: delDbErr } = await supabase.from("imovel_fotos").delete().eq("id", row.id);
    if (delDbErr) {
      setErr(delDbErr.message);
      return;
    }
    await supabase.storage.from(FOTOS_BUCKET).remove([row.caminho_arquivo]);
    await load();
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-blue-700" />
          <h3 className="text-sm font-semibold text-slate-900">Fotos do imóvel</h3>
          <span className="text-xs text-slate-500">({fotos.length})</span>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-gradient-to-br from-blue-600 to-blue-800 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:brightness-110">
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Enviar fotos
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </label>
      </div>
      <p className="mb-3 text-[11px] text-slate-500">
        JPG, PNG ou WebP · até 5 MB por arquivo.
      </p>
      {err && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {err}
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando fotos...
        </div>
      ) : fotos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
          Nenhuma foto enviada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {fotos.map((f) => {
            const { data } = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(f.caminho_arquivo);
            return (
              <div
                key={f.id}
                className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
              >
                <img
                  src={data.publicUrl}
                  alt="Foto do imóvel"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                <button
                  type="button"
                  onClick={() => remove(f)}
                  className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-red-600 shadow-sm opacity-0 transition group-hover:opacity-100 hover:bg-white"
                  aria-label="Remover foto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function DocumentosImovel({ imovelId }: { imovelId: number | null }) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("documentos")
      .select("id,titulo,categoria,descricao,caminho_arquivo,imovel_id")
      .order("id", { ascending: false });
    q = imovelId == null ? q.is("imovel_id", null) : q.eq("imovel_id", imovelId);
    const { data, error } = await q;
    if (error) setErr(error.message);
    else setDocs(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imovelId]);

  async function handleFile(file: File) {
    setErr(null);
    if (!titulo.trim() || !categoria.trim()) {
      setErr("Informe título e categoria antes de enviar.");
      return;
    }
    if (!DOC_TYPES.includes(file.type) && !/\.(pdf|docx)$/i.test(file.name)) {
      setErr(`Formato não suportado: ${file.name} (use PDF ou DOCX).`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr(`${file.name} excede 5 MB.`);
      return;
    }
    setUploading(true);
    const folder = imovelId == null ? "geral" : String(imovelId);
    const path = `${folder}/${crypto.randomUUID()}.${extFromName(file.name)}`;
    try {
      const { error: upErr } = await supabase.storage
        .from(DOCS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { error: insErr } = await supabase.from("documentos").insert({
        titulo: titulo.trim(),
        categoria: categoria.trim(),
        descricao: descricao.trim() || null,
        caminho_arquivo: path,
        imovel_id: imovelId,
      });
      if (insErr) {
        await supabase.storage.from(DOCS_BUCKET).remove([path]);
        throw new Error(insErr.message);
      }
      setTitulo("");
      setCategoria("");
      setDescricao("");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function abrir(row: DocRow) {
    const { data, error } = await supabase.storage
      .from(DOCS_BUCKET)
      .createSignedUrl(row.caminho_arquivo, 60);
    if (error) {
      setErr(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(row: DocRow) {
    if (!confirm(`Remover "${row.titulo}"?`)) return;
    const { error: delErr } = await supabase.from("documentos").delete().eq("id", row.id);
    if (delErr) {
      setErr(delErr.message);
      return;
    }
    await supabase.storage.from(DOCS_BUCKET).remove([row.caminho_arquivo]);
    await load();
  }

  const inp =
    "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  const lbl = "mb-1 block text-xs font-medium text-slate-700";

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-blue-700" />
        <h3 className="text-sm font-semibold text-slate-900">
          Documentos {imovelId == null ? "gerais" : "do imóvel"}
        </h3>
        <span className="text-xs text-slate-500">({docs.length})</span>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={lbl}>Título</label>
          <input
            className={inp}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Matrícula do imóvel"
          />
        </div>
        <div>
          <label className={lbl}>Categoria</label>
          <input
            className={inp}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Ex: Matrícula, Contrato, Certidão"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Descrição (opcional)</label>
          <input
            className={inp}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Observações internas"
          />
        </div>
      </div>

      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-gradient-to-br from-blue-600 to-blue-800 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:brightness-110">
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        Enviar documento
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          disabled={uploading}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </label>
      <p className="mt-2 text-[11px] text-slate-500">
        PDF ou DOCX · até 5 MB · acesso restrito a usuários autenticados.
      </p>

      {err && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {err}
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando documentos...
          </div>
        ) : docs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
            Nenhum documento enviado ainda.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{d.titulo}</div>
                  <div className="truncate text-xs text-slate-500">
                    {d.categoria}
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
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
