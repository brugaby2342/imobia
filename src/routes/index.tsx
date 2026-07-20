import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Copiloto Imobiliário" },
      {
        name: "description",
        content: "Copiloto de consulta de imóveis para imobiliárias.",
      },
      { property: "og:title", content: "Copiloto Imobiliário" },
      {
        property: "og:description",
        content: "Copiloto de consulta de imóveis para imobiliárias.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Copiloto Imobiliário
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Em breve: consulta inteligente de imóveis. Conecte seu banco de dados
          e defina os requisitos para começar.
        </p>
      </div>
    </main>
  );
}
