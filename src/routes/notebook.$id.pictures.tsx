import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { colorOf, useNotebook, useNotebookEntries } from "@/lib/journal";
import { generatePhotoSummary } from "@/lib/photo-summary.functions";

export const Route = createFileRoute("/notebook/$id/pictures")({
  head: () => ({
    meta: [
      { title: "Month in Pictures — Memory Journal" },
      {
        name: "description",
        content:
          "A photo recap of your month with a short AI reflection on the moments and themes captured.",
      },
      { property: "og:title", content: "Month in Pictures — Memory Journal" },
      {
        property: "og:description",
        content: "A photo recap of your month with a warm AI reflection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonthInPictures,
});

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CACHE_KEY = "memory-journal-photo-summaries-v1";
const MAX_PHOTOS = 12;

interface Cached {
  signature: string;
  summary: string;
  tags: string[];
}

function readCache(): Record<string, Cached> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, Cached>;
  } catch {
    return {};
  }
}

function writeCache(key: string, value: Cached) {
  try {
    const c = readCache();
    c[key] = value;
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

function MonthInPictures() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const notebook = useNotebook(id);
  const entries = useNotebookEntries(id);

  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [summary, setSummary] = useState<Cached | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = `${MONTHS[month]} ${year}`;
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const photos = useMemo(
    () =>
      Object.values(entries)
        .filter((e) => e.date.startsWith(prefix) && !!e.image)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((e) => ({ date: e.date, image: e.image as string })),
    [entries, prefix]
  );

  const cacheKey = `${id}::${prefix}`;
  const signature = useMemo(
    () => photos.map((p) => `${p.date}:${p.image.length}`).join("|"),
    [photos]
  );

  const run = useCallback(
    async (force: boolean) => {
      if (!notebook || !photos.length) return;
      if (!force) {
        const cached = readCache()[cacheKey];
        if (cached && cached.signature === signature) {
          setSummary(cached);
          setFailed(false);
          return;
        }
      }
      setLoading(true);
      setFailed(false);
      try {
        const res = await generatePhotoSummary({
          data: {
            notebookName: notebook.name,
            monthLabel,
            photos: photos.slice(0, MAX_PHOTOS).map((p) => ({ date: p.date, dataUrl: p.image })),
          },
        });
        const next: Cached = { signature, summary: res.summary, tags: res.tags };
        setSummary(next);
        writeCache(cacheKey, next);
      } catch {
        setSummary(null);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [notebook, photos, cacheKey, signature, monthLabel]
  );

  useEffect(() => {
    setSummary(null);
    setFailed(false);
    void run(false);
  }, [run]);

  if (!notebook) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-xl font-semibold">Notebook not found</h1>
        <Link
          to="/"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Back to notebooks
        </Link>
      </main>
    );
  }

  const c = colorOf(notebook.color);
  const shift = (delta: number) => setCursor(new Date(year, month + delta, 1));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-16 pt-6">
      <header className="fade-slide-in mb-5 flex items-start gap-3">
        <button
          type="button"
          aria-label="Back to calendar"
          onClick={() => navigate({ to: "/notebook/$id", params: { id } })}
          className="mt-1 grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-semibold tracking-tight text-primary">
            Month in Pictures
          </h1>
          <p className="truncate text-xs text-muted-foreground">{notebook.name}</p>
        </div>
        <span
          className="mt-1 grid size-10 shrink-0 place-items-center rounded-2xl text-xl"
          style={{ background: c.swatch }}
          aria-hidden
        >
          {notebook.icon}
        </span>
      </header>

      <div className="mb-5 flex items-center justify-between rounded-full border border-border bg-card px-2 py-1.5">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shift(-1)}
          className="grid size-9 place-items-center rounded-full text-primary transition-colors hover:bg-teal-soft"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="font-display text-base font-semibold">{monthLabel}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => shift(1)}
          className="grid size-9 place-items-center rounded-full text-primary transition-colors hover:bg-teal-soft"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {photos.length > 0 && (
        <section className="fade-slide-in mb-5 rounded-3xl border border-border bg-gradient-to-br from-secondary/60 via-card to-card p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">
              <Sparkles className="size-3" aria-hidden /> AI reflection
            </span>
            <button
              type="button"
              onClick={() => void run(true)}
              disabled={loading}
              aria-label="Regenerate photo summary"
              title="Regenerate"
              className="grid size-8 place-items-center rounded-full text-primary transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2.5 py-1" aria-label="Looking through your photos">
              <div className="h-2.5 w-full animate-pulse rounded-full bg-border" />
              <div className="h-2.5 w-11/12 animate-pulse rounded-full bg-border" />
              <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-border" />
            </div>
          ) : failed ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Photo summary isn't available right now — your photos are still all here below.
            </p>
          ) : summary ? (
            <>
              <p className="text-[15px] leading-relaxed text-secondary-foreground">
                {summary.summary}
              </p>
              {summary.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {summary.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </section>
      )}

      {photos.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          No photos in {monthLabel} yet — add one to a day's entry and it'll show up here.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <button
              key={p.date}
              type="button"
              onClick={() => setLightbox(i)}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border transition-transform active:scale-95"
            >
              <img
                src={p.image}
                alt={`Photo from ${p.date}`}
                loading="lazy"
                className="size-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 bg-black/35 py-0.5 text-center text-[10px] font-semibold text-white">
                {Number(p.date.slice(8))}
              </span>
            </button>
          ))}
        </div>
      )}

      {lightbox !== null && photos[lightbox] && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-foreground/90 p-5">
          <button
            type="button"
            aria-label="Close slideshow"
            onClick={() => setLightbox(null)}
            className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-background/90 text-foreground"
          >
            <X className="size-5" />
          </button>
          <img
            src={photos[lightbox]!.image}
            alt={`Photo from ${photos[lightbox]!.date}`}
            className="max-h-[70vh] w-auto rounded-2xl object-contain"
          />
          <div className="flex items-center gap-6">
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => setLightbox((i) => ((i ?? 0) - 1 + photos.length) % photos.length)}
              className="grid size-11 place-items-center rounded-full bg-background/90 text-foreground"
            >
              <ChevronLeft className="size-5" />
            </button>
            <span className="text-sm font-medium text-background">
              {photos[lightbox]!.date}
            </span>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => setLightbox((i) => ((i ?? 0) + 1) % photos.length)}
              className="grid size-11 place-items-center rounded-full bg-background/90 text-foreground"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
