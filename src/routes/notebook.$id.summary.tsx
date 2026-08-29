import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  MOODS,
  colorOf,
  getPeriod,
  recentPeriods,
  useNotebook,
  useNotebookEntries,
  useSaveSummary,
  useSummaries,
  type Period,
  type PeriodType,
} from "@/lib/journal";
import { generateNotebookSummary } from "@/lib/summary.functions";

export const Route = createFileRoute("/notebook/$id/summary")({
  head: () => ({
    meta: [
      { title: "AI Summary Notebook — Memory Journal" },
      {
        name: "description",
        content:
          "Weekly and monthly AI summaries of your journal: themes, notable moments and overall progress.",
      },
      { property: "og:title", content: "AI Summary Notebook — Memory Journal" },
      {
        property: "og:description",
        content: "AI-written weekly and monthly recaps of one of your journal notebooks.",
      },
    ],
  }),
  component: SummaryNotebook,
});

function SummaryNotebook() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const notebook = useNotebook(id);
  const entries = useNotebookEntries(id);
  const [cadence, setCadence] = useState<PeriodType>("weekly");
  const summaries = useSummaries(id, cadence);
  const saveSummary = useSaveSummary();
  const generate = useServerFn(generateNotebookSummary);

  const periods = useMemo(() => recentPeriods(cadence, 6), [cadence]);
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected: Period =
    periods.find((p) => p.start === periodStart) ?? periods[0] ?? getPeriod(cadence, new Date());
  const existing = summaries.find((s) => s.periodStart === selected.start);

  if (!notebook) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">This notebook no longer exists.</p>
        <Link to="/" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Back to notebooks
        </Link>
      </main>
    );
  }

  const c = colorOf(notebook.color);

  function markerFor(date: string): string {
    const e = entries[date];
    if (!e || !notebook) return "";
    if (notebook.type === "mood")
      return e.mood ? (MOODS.find((m) => m.id === e.mood)?.label ?? "") : "";
    return e.status === null ? "" : notebook.labels[e.status];
  }

  const inPeriod = Object.values(entries)
    .filter((e) => e.date >= selected.start && e.date <= selected.end)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  async function onGenerate() {
    if (!notebook) return;
    if (!inPeriod.length) {
      toast.error(`No entries in ${selected.label} yet.`);
      return;
    }
    setBusy(true);
    try {
      const res = await generate({
        data: {
          notebookName: notebook.name,
          notebookType: notebook.type,
          periodLabel: selected.label,
          entries: inPeriod.map((e) => ({
            date: e.date,
            text: e.text,
            marker: markerFor(e.date),
          })),
        },
      });
      const counts = new Map<string, number>();
      for (const e of inPeriod) {
        const m = markerFor(e.date);
        if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
      }
      saveSummary({
        parentNotebookId: id,
        periodType: cadence,
        periodLabel: selected.label,
        periodStart: selected.start,
        periodEnd: selected.end,
        summaryText: res.summaryText,
        breakdown: [...counts].map(([label, count]) => ({ label, count })),
      });
      toast.success(`Summary ready for ${selected.label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Summary generation failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-16 pt-6">
      <header className="fade-slide-in mb-5 flex items-start gap-3">
        <button
          type="button"
          aria-label="Back to notebooks"
          onClick={() => navigate({ to: "/" })}
          className="mt-1 grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">
            <Sparkles className="size-3" aria-hidden /> AI summary
          </span>
          <h1 className="mt-1.5 truncate font-display text-2xl font-semibold tracking-tight text-primary">
            {notebook.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            Generated recaps · read-only, your entries stay in the notebook
          </p>
        </div>
        <span
          className="mt-1 grid size-10 shrink-0 place-items-center rounded-2xl text-xl"
          style={{ background: c.swatch }}
          aria-hidden
        >
          {notebook.icon}
        </span>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-border bg-card p-1">
        {(["weekly", "monthly"] as PeriodType[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setCadence(p);
              setPeriodStart(null);
            }}
            aria-pressed={cadence === p}
            className={`rounded-full py-2 text-sm font-semibold capitalize transition-colors ${
              cadence === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <section className="fade-slide-in rounded-3xl border border-border bg-gradient-to-br from-secondary/60 via-card to-card p-5">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Period
        </label>
        <select
          value={selected.start}
          onChange={(e) => setPeriodStart(e.target.value)}
          className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm font-medium text-foreground"
        >
          {periods.map((p, i) => (
            <option key={p.start} value={p.start}>
              {p.label}
              {i === 0 ? (cadence === "weekly" ? " (this week)" : " (this month)") : ""}
            </option>
          ))}
        </select>

        <p className="mt-2 text-xs text-muted-foreground">
          {inPeriod.length} {inPeriod.length === 1 ? "entry" : "entries"} in this period
          {existing ? " · already summarised" : ""}
        </p>

        <button
          type="button"
          onClick={onGenerate}
          disabled={busy}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-80 ${
            busy ? "animate-pulse" : ""
          }`}
        >
          {busy ? (
            <>
              <Sparkles className="size-4 animate-spin" aria-hidden /> Thinking…
            </>
          ) : existing ? (
            <>
              <RefreshCw className="size-4" aria-hidden /> Regenerate summary
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden /> Generate summary
            </>
          )}
        </button>
      </section>

      <h2 className="mt-8 mb-3 font-display text-lg font-semibold text-foreground">
        Past summaries
      </h2>

      {summaries.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-input bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No {cadence} summaries yet. Generate one once you have a few entries.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {summaries.map((s) => (
            <li
              key={s.id}
              className="fade-slide-in rounded-3xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-base font-semibold text-primary">
                  {s.periodLabel}
                </h3>
                <Sparkles className="size-3.5 shrink-0 text-accent" aria-hidden />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {s.summaryText}
              </p>
              {s.breakdown.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {s.breakdown.map((b) => (
                    <li
                      key={b.label}
                      className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                    >
                      {b.label} · {b.count}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
