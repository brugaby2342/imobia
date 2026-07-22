import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Plus, Building2, Loader2, LogOut, MapPin, Ruler, BedDouble, FileCheck2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "ImobIA — Copiloto Litoral Prime" },
      {
        name: "description",
        content:
          "ImobIA: copiloto de consulta do portfólio da imobiliária Litoral Prime em linguagem natural.",
      },
      { property: "og:title", content: "ImobIA — Copiloto Litoral Prime" },
      {
        property: "og:description",
        content:
          "Consulte o portfólio de imóveis da Litoral Prime em linguagem natural.",
      },
    ],
  }),
  component: Index,
});

type Imovel = {
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
};
type Msg = { role: "user" | "assistant"; content: string; imoveis?: Imovel[] };

const brl = (v: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

function ImovelCard({ im }: { im: Imovel }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {im.tipo ?? "Imóvel"}
            {im.bairro ? <span className="text-blue-700"> · {im.bairro}</span> : null}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {[im.cidade, im.estado].filter(Boolean).join(" / ") || "Localização não informada"}
            </span>
          </p>
        </div>
        <div className="shrink-0 rounded-md bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-800">
          {brl(im.valor)}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-1">
          <Ruler className="h-3.5 w-3.5 text-slate-400" />
          <span>{im.area_m2 != null ? `${im.area_m2} m²` : "—"}</span>
        </div>
        <div className="flex items-center gap-1">
          <BedDouble className="h-3.5 w-3.5 text-slate-400" />
          <span>{im.quartos != null ? `${im.quartos} quartos` : "—"}</span>
        </div>
        <div className="flex items-center gap-1 justify-self-end">
          <FileCheck2 className="h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>
      {im.status_documentacao && (
        <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-500">
          <span className="font-medium text-slate-600">Situação documental:</span>{" "}
          {im.status_documentacao}
        </div>
      )}
      {im.descricao && (
        <p className="mt-2 line-clamp-2 text-xs text-slate-600">{im.descricao}</p>
      )}
    </div>
  );
}

const SUGESTOES = [
  "Quais apartamentos de até R$ 800 mil em Balneário Camboriú?",
  "Casas com 3+ quartos em Florianópolis com documentação em dia",
  "Coberturas acima de 150 m² no litoral de SC",
];

function Index() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
        imoveis?: Imovel[];
      };
      if (!res.ok) {
        const errMsg =
          res.status === 401
            ? "Sessão expirada. Faça login novamente."
            : res.status === 429
              ? "Limite de requisições atingido. Tente novamente em instantes."
              : res.status === 402
                ? "Créditos de IA esgotados. Peça ao administrador para adicionar créditos."
                : data.error || "Falha ao consultar o copiloto.";
        setMessages([...next, { role: "assistant", content: `⚠️ ${errMsg}` }]);
      } else {
        setMessages([
          ...next,
          { role: "assistant", content: data.text ?? "", imoveis: data.imoveis ?? [] },
        ]);
      }
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "⚠️ Erro de rede. Verifique sua conexão." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function novaConversa() {
    setMessages([]);
    setInput("");
  }

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-blue-50/40">
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-semibold tracking-tight text-slate-900">ImobIA</h1>
              <p className="text-xs text-slate-500">Copiloto · Litoral Prime</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {email && (
              <span className="hidden max-w-[200px] truncate text-xs text-slate-600 sm:inline">
                {email}
              </span>
            )}
            <button
              onClick={novaConversa}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova conversa
            </button>
            <button
              onClick={sair}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main
        ref={scrollRef}
        className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-4 py-6"
      >
        {messages.length === 0 ? (
          <div className="mx-auto mt-8 max-w-2xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-md">
              <Building2 className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Consulte o portfólio em linguagem natural
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Pergunte sobre imóveis, filtros por bairro, valor, área ou situação documental.
              O ImobIA responde apenas com base no portfólio real da Litoral Prime.
            </p>
            <div className="mt-6 grid gap-2 text-left sm:grid-cols-1">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-blue-700 px-4 py-2.5 text-sm text-white shadow-sm"
                      : "max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm"
                  }
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-strong:text-slate-900">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Consultando portfólio...
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <div className="sticky bottom-0 border-t border-slate-200/70 bg-white/90 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-4xl items-end gap-2 px-4 py-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Pergunte sobre imóveis do portfólio..."
            className="min-h-[44px] max-h-40 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Enviar"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
        <p className="pb-2 text-center text-[11px] text-slate-400">
          Respostas baseadas apenas no portfólio real. Sem invenção de imóveis.
        </p>
      </div>
    </div>
  );
}
