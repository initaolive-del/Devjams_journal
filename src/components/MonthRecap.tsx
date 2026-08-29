import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ImageOff, Pause, Play, X } from "lucide-react";
import { toDateKey, type JournalEntry } from "@/lib/journal";

interface Props {
  notebookId: string;
  notebookName: string;
  year: number;
  month: number; // 0-indexed
  monthLabel: string;
  entries: Record<string, JournalEntry>;
  onClose: () => void;
}

export function MonthRecap({
  notebookId,
  notebookName,
  year,
  month,
  monthLabel,
  entries,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"grid" | "slideshow">("grid");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const days = useMemo(() => {
    const total = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: total }, (_, i) => {
      const day = i + 1;
      const key = toDateKey(new Date(year, month, day));
      return { day, key, image: entries[key]?.image ?? null };
    });
  }, [entries, year, month]);

  const photos = useMemo(() => days.filter((d) => d.image), [days]);

  useEffect(() => {
    if (mode !== "slideshow" || !playing || photos.length === 0) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % photos.length), 2200);
    return () => clearTimeout(t);
  }, [mode, playing, index, photos.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const open = (date: string) =>
    navigate({ to: "/notebook/$id/entry/$date", params: { id: notebookId, date } });

  const current = photos[index];

  return (
    <div className="recap-overlay fixed inset-0 z-50 overflow-y-auto bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-5 pb-10 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ember">
              Month in pictures
            </p>
            <h2 className="truncate font-display text-2xl font-semibold tracking-tight">
              {monthLabel} {year}
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {notebookName} · {photos.length} {photos.length === 1 ? "photo" : "photos"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close recap"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full text-primary transition-colors hover:bg-teal-soft"
          >
            <X className="size-5" />
          </button>
        </div>

        {photos.length === 0 ? (
          <div className="fade-slide-in mt-10 flex flex-col items-center gap-3 rounded-3xl border border-border bg-card px-6 py-14 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-sand">
              <ImageOff className="size-6 text-ember" aria-hidden />
            </span>
            <h3 className="font-display text-lg font-semibold">No photos yet this month</h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              Start adding memories and they'll come together here as a picture-a-day recap.
            </p>
          </div>
        ) : mode === "slideshow" && current ? (
          <div className="mt-6 flex flex-col gap-4">
            <button
              type="button"
              onClick={() => open(current.key)}
              className="relative block w-full overflow-hidden rounded-3xl border border-border bg-muted"
            >
              <img
                key={current.key}
                src={current.image!}
                alt={`Photo from ${monthLabel} ${current.day}`}
                className="slide-fade aspect-square w-full object-cover"
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-background/85 px-3 py-1 text-xs font-semibold">
                {monthLabel} {current.day}
              </span>
            </button>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
                className="grid size-10 place-items-center rounded-full bg-muted text-primary transition-transform active:scale-95"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label={playing ? "Pause slideshow" : "Play slideshow"}
                onClick={() => setPlaying((p) => !p)}
                className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
              >
                {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => setIndex((i) => (i + 1) % photos.length)}
                className="grid size-10 place-items-center rounded-full bg-muted text-primary transition-transform active:scale-95"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {photos.map((p, i) => (
                <span
                  key={p.key}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-5 bg-ember" : "w-1.5 bg-border"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setMode("grid")}
              className="mx-auto rounded-full px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-teal-soft"
            >
              Back to grid
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {days.map((d, i) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => open(d.key)}
                  aria-label={`${monthLabel} ${d.day}${d.image ? ", view photo" : ", no photo"}`}
                  className="recap-cell relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted"
                  style={{ animationDelay: `${Math.min(i * 55, 1600)}ms` }}
                >
                  {d.image ? (
                    <img
                      src={d.image}
                      alt={`Photo from ${monthLabel} ${d.day}`}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="grid size-full place-items-center bg-secondary/40" aria-hidden />
                  )}
                  <span
                    className={`absolute bottom-1 right-1.5 text-[10px] font-semibold ${
                      d.image
                        ? "rounded-full bg-background/80 px-1.5 py-0.5"
                        : "text-muted-foreground"
                    }`}
                  >
                    {d.day}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setIndex(0);
                setPlaying(true);
                setMode("slideshow");
              }}
              className="mx-auto mt-6 flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
            >
              <Play className="size-4" aria-hidden />
              Play slideshow
            </button>
          </>
        )}
      </div>
    </div>
  );
}
