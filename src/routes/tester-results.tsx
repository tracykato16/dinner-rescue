import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrototypeFooter } from "@/components/PrototypeFooter";
import { clearData, readData, type TesterData } from "@/lib/tester-store";

export const Route = createFileRoute("/tester-results")({
  head: () => ({
    meta: [
      { title: "Tester results — Dinner Rescue" },
      {
        name: "description",
        content:
          "Local prototype results for Dinner Rescue: rescue sessions, chosen dinners and tester feedback stored on this device.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Tester results — Dinner Rescue" },
      {
        property: "og:description",
        content: "Aggregate counts and written comments from Dinner Rescue testers on this device.",
      },
    ],
  }),
  component: TesterResults,
});

const LABELS: Record<string, string> = {
  cooked: "I cooked it",
  "no-shop": "Saved me a shop trip",
  "used-up": "Used something that needed using",
  "no-help": "Didn't help tonight",
};

function TesterResults() {
  const [data, setData] = useState<TesterData | null>(null);

  useEffect(() => {
    setData(readData());
  }, []);

  const counts: Record<string, number> = {};
  for (const f of data?.feedback ?? []) {
    for (const t of f.tags) counts[t] = (counts[t] ?? 0) + 1;
  }

  const recipeCounts = new Map<string, number>();
  for (const s of data?.selections ?? []) {
    recipeCounts.set(s.recipeName, (recipeCounts.get(s.recipeName) ?? 0) + 1);
  }
  const topRecipes = [...recipeCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="page-warm flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-4 pt-6">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <Link
            to="/"
            aria-label="Back to Dinner Rescue"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              This device only
            </p>
            <h1 className="truncate text-2xl">Tester results</h1>
          </div>
        </div>

        {!data ? (
          <p className="mt-8 text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Stat label="Rescue sessions" value={data.sessions} />
              <Stat label="Dinners chosen" value={data.selections.length} />
              <Stat label="Feedback given" value={data.feedback.length} />
              <Stat label="No-shop wins" value={counts["no-shop"] ?? 0} />
            </div>

            <section className="card-soft mt-6 p-5">
              <h2 className="text-lg">Feedback counts</h2>
              <ul className="mt-3 space-y-2">
                {Object.keys(LABELS).map((k) => (
                  <li key={k} className="flex items-center justify-between gap-3 text-base">
                    <span className="min-w-0">{LABELS[k]}</span>
                    <span className="shrink-0 font-semibold">{counts[k] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card-soft mt-4 p-5">
              <h2 className="text-lg">Dinners chosen</h2>
              {topRecipes.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nothing selected yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {topRecipes.map(([name, n]) => (
                    <li key={name} className="flex items-center justify-between gap-3 text-base">
                      <span className="min-w-0">{name}</span>
                      <span className="shrink-0 font-semibold">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card-soft mt-4 p-5">
              <h2 className="text-lg">Written comments</h2>
              {data.feedback.filter((f) => f.comment).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {data.feedback
                    .filter((f) => f.comment)
                    .slice()
                    .reverse()
                    .map((f, i) => (
                      <li key={i} className="rounded-xl bg-secondary p-4">
                        <p className="text-base leading-relaxed">“{f.comment}”</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {f.recipeName} · {new Date(f.at).toLocaleString("en-AU")}
                        </p>
                      </li>
                    ))}
                </ul>
              )}
            </section>

            <Button
              variant="outline"
              size="tap"
              className="mt-6 w-full"
              onClick={() => {
                clearData();
                setData(readData());
              }}
            >
              <Trash2 aria-hidden /> Clear results on this device
            </Button>
          </>
        )}
      </main>
      <PrototypeFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-soft p-4">
      <p className="text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
