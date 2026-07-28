import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { Building2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/imoveis")({
  beforeLoad: ({ context }) => {
    const role = (context as { role?: string }).role;
    if (role !== "admin" && role !== "corretor") {
      throw redirect({ to: "/", search: { denied: 1 } });
    }
  },
  component: ImoveisLayout,
});

function ImoveisLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-blue-50/40">
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-semibold tracking-tight text-slate-900">
                Gerenciar imóveis
              </h1>
              <p className="text-xs text-slate-500">ImobIA · Litoral Prime</p>
            </div>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao chat
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
