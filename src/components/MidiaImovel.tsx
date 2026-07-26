import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload, Trash2, ImageIcon, FileText, Download, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const FOTOS_BUCKET = "imovel_fotos";
const DOCS_BUCKET = "documentos";
const MAX_BYTES = 5 * 1024 * 1024;
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

/** Extrai o maior sequencial N de caminhos no padrão imovel_{id}_{N}.ext */
function maxSequencial(paths: string[], imovelId: number): number {
  const prefix = `imovel_${pad3(imovelId)}_`;
  let max = 0;
  const re = new RegExp(`^imovel_${pad3(imovelId)}_(\\d+)\\.`);
  for (const p of paths) {
    const base = p.split("/").pop() ?? p;
    if (!base.startsWith(prefix)) continue;
    const m = base.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}

export function FotosImovel({ imovelId }: { imovelId: number }) {
  const [fotos, setFotos] = useState<FotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(
    () => pending.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [pending],
  );
  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

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

  function addFiles(files: FileList) {
    setErr(null);
    const next: File[] = [];
    for (const file of Array.from(files)) {
      if (!IMG_TYPES.includes(file.type)) {
        setErr(`Formato não suportado: ${file.name} (use JPG, PNG ou WebP).`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setErr(`${file.name} excede 5 MB.`);
        continue;
      }
      next.push(file);
    }
    if (next.length) setPending((prev) => [...prev, ...next]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removePending(idx: number) {
    setPending((prev) => prev.filter((_, i) => i !== idx));
  }

  async function enviar() {
    if (!pending.length) return;
    setErr(null);
    setUploading(true);
    const count = pending.length;
    try {
      // Buscar sequencial atual, tanto dos caminhos no banco quanto dos objetos no bucket
      const dbPaths = fotos.map((f) => f.caminho_arquivo);
      const { data: listData } = await supabase.storage
        .from(FOTOS_BUCKET)
        .list("", { limit: 1000, search: `imovel_${pad3(imovelId)}_` });
      const bucketPaths = (listData ?? []).map((o) => o.name);
      let seq = maxSequencial([...dbPaths, ...bucketPaths], imovelId);

      let ordem = fotos.length;
      for (const file of pending) {
        seq += 1;
        ordem += 1;
        const path = `imovel_${pad3(imovelId)}_${seq}.${extFromName(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from(FOTOS_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { error: insErr } = await supabase
          .from("imovel_fotos")
          .insert({ imovel_id: imovelId, caminho_arquivo: path, ordem });
        if (insErr) {
          await supabase.storage.from(FOTOS_BUCKET).remove([path]);
          throw new Error(insErr.message);
        }
      }
      setPending([]);
      await load();
      toast.success(count === 1 ? "Foto enviada com sucesso." : `${count} fotos enviadas com sucesso.`);
    } catch (e) {
      setErr((e as Error).message);
      toast.error(`Falha ao enviar foto: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  async function remove(row: FotoRow) {
    if (!confirm("Remover esta foto?")) return;
    setErr(null);

    // 1) Storage primeiro (remove() não erra em caminho inexistente — comparamos o retorno).
    let missing = false;
    try {
      const out = await removeFromStorage(FOTOS_BUCKET, [row.caminho_arquivo]);
      missing = out.missing.length > 0;
      if (missing) {
        toast.warning(
          `Arquivo "${row.caminho_arquivo}" não foi encontrado no bucket "${FOTOS_BUCKET}". O registro será removido; verifique arquivos órfãos no Storage.`,
        );
      }
    } catch (e) {
      const msg = (e as Error).message;
      setErr(msg);
      toast.error(`Falha ao remover o arquivo do Storage: ${msg}. O registro foi mantido.`);
      return;
    }

    // 2) Banco.
    const { error: delDbErr } = await supabase.from("imovel_fotos").delete().eq("id", row.id);
    if (delDbErr) {
      setErr(delDbErr.message);
      toast.error(
        missing
          ? `O registro da foto #${row.id} não pôde ser excluído: ${delDbErr.message}.`
          : `Arquivo já removido do Storage, mas o registro da foto #${row.id} NÃO foi excluído: ${delDbErr.message}. A galeria vai exibir imagem quebrada — tente remover novamente.`,
      );
      await load();
      return;
    }
    await load();
    toast.success(missing ? "Registro removido (arquivo não existia no Storage)." : "Foto removida.");
  }


  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-blue-700" />
          <h3 className="text-sm font-semibold text-slate-900">Fotos do imóvel</h3>
          <span className="text-xs text-slate-500">({fotos.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
            <ImageIcon className="h-3.5 w-3.5" />
            Selecionar fotos
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
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
        </div>
      </div>
      <p className="mb-3 text-[11px] text-slate-500">
        JPG, PNG ou WebP · até 5 MB por arquivo.
      </p>
      {err && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {err}
        </div>
      )}

      {previews.length > 0 && (
        <div className="mb-4 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-3">
          <div className="mb-2 text-xs font-medium text-slate-700">
            Pré-visualização ({previews.length})
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {previews.map((p, idx) => (
              <div
                key={idx}
                className="group relative overflow-hidden rounded-md border border-slate-200 bg-white"
              >
                <img
                  src={p.url}
                  alt={p.file.name}
                  className="aspect-square w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePending(idx)}
                  disabled={uploading}
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-red-600 shadow-sm hover:bg-white"
                  aria-label="Remover da fila"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="truncate px-1.5 py-1 text-[10px] text-slate-500">
                  {p.file.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando fotos...
        </div>
      ) : fotos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
          Nenhuma foto cadastrada. Selecione arquivos acima para enviar.
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

/** Listagem read-only dos documentos vinculados ao imóvel. Uploads são feitos na tela /documentos. */
export function DocumentosImovel({ imovelId }: { imovelId: number | null }) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-blue-700" />
        <h3 className="text-sm font-semibold text-slate-900">
          Documentos {imovelId == null ? "gerais" : "do imóvel"}
        </h3>
        <span className="text-xs text-slate-500">({docs.length})</span>
      </div>
      <p className="mb-3 text-[11px] text-slate-500">
        Somente leitura. Para enviar novos documentos, acesse a tela <strong>Documentos</strong>.
      </p>

      {err && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {err}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando documentos...
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
          Nenhum documento vinculado a este imóvel.
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
    </section>
  );
}
