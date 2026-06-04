import { createFileRoute } from "@tanstack/react-router";
import { matches } from "@/lib/mock-data";
import { MatchCard } from "@/components/MatchCard";

export const Route = createFileRoute("/_app/partidos/")({
  component: PartidosList,
});

function PartidosList() {
  const open = matches.filter((m) => m.status === "open");
  const past = matches.filter((m) => m.status !== "open");

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-6">
      <header className="mb-6">
        <h1 className="font-display text-4xl md:text-5xl uppercase">Partidos</h1>
        <p className="text-muted-foreground text-sm mt-1">Anotate al próximo o revisá los pasados.</p>
      </header>

      <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Próximos</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {open.map((m) => <MatchCard key={m.id} match={m} />)}
      </div>

      {past.length > 0 && (
        <>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 mt-10">Anteriores</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
            {past.map((m) => <MatchCard key={m.id} match={m} />)}
          </div>
        </>
      )}
    </div>
  );
}
