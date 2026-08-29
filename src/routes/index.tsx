import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import {
  colorOf,
  relativeTime,
  useCreateNotebook,
  useNotebooks,
} from "@/lib/journal";
import { NotebookForm } from "@/components/NotebookForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Notebooks — Memory Journal" },
      {
        name: "description",
        content:
          "Keep separate notebooks for moods, habits and goals. Each one has its own calendar, photos and voice notes.",
      },
      { property: "og:title", content: "Notebooks — Memory Journal" },
      {
        property: "og:description",
        content:
          "Keep separate notebooks for moods, habits and goals, each with its own calendar and daily entries.",
      },
    ],
  }),
  component: NotebooksHome,
});

function NotebooksHome() {
  const notebooks = useNotebooks();
  const create = useCreateNotebook();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-16 pt-8">
      <header className="fade-slide-in mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-primary">
          Your Notebooks
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {notebooks.length
            ? `${notebooks.length} ${notebooks.length === 1 ? "notebook" : "notebooks"}`
            : "Create your first notebook to start journalling"}
        </p>
      </header>

      {adding ? (
        <section className="fade-slide-in rounded-3xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">New notebook</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setAdding(false)}
              className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>
          <NotebookForm
            submitLabel="Create notebook"
            onCancel={() => setAdding(false)}
            onSubmit={(draft) => {
              const nb = create(draft);
              setAdding(false);
              navigate({ to: "/notebook/$id", params: { id: nb.id } });
            }}
          />
        </section>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {notebooks.map((n) => {
              const c = colorOf(n.color);
              return (
                <li key={n.id} className="fade-slide-in rounded-3xl border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/notebook/$id", params: { id: n.id } })}
                    className="flex w-full items-center gap-4 rounded-3xl p-4 text-left transition-transform active:scale-[0.98]"
                  >
                    <span
                      className="grid size-14 shrink-0 place-items-center rounded-2xl text-2xl"
                      style={{ background: c.swatch }}
                      aria-hidden
                    >
                      {n.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-lg font-semibold text-foreground">
                        {n.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {n.entryCount} {n.entryCount === 1 ? "entry" : "entries"} ·{" "}
                        {relativeTime(n.lastUpdated)}
                      </span>
                      <span className="mt-1.5 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {n.type === "mood" ? "Mood" : `${n.labels[0]} / ${n.labels[1]}`}
                      </span>
                    </span>
                  </button>
                  <div className="border-t border-border px-4 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        navigate({ to: "/notebook/$id/summary", params: { id: n.id } })
                      }
                      className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-transform active:scale-95"
                    >
                      <Sparkles className="size-3.5" aria-hidden />
                      View AI Summary
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>


          {notebooks.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-input bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Notebooks keep different parts of your life apart — moods, habits, goals.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-5 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
          >
            <Plus className="size-4" aria-hidden />
            Add Notebook
          </button>
        </>
      )}
    </main>
  );
}
