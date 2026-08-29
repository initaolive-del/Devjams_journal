import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { MOODS, toDateKey, useEntries } from "@/lib/journal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Memory Journal — Daily Photo, Mood & Voice Diary" },
      {
        name: "description",
        content:
          "A calm calendar journal. Tap any day to add a photo, log your mood, and write or speak your entry.",
      },
      { property: "og:title", content: "Memory Journal — Daily Photo, Mood & Voice Diary" },
      {
        property: "og:description",
        content:
          "A calm calendar journal. Tap any day to add a photo, log your mood, and write or speak your entry.",
      },
    ],
  }),
  component: CalendarHome,
});

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function CalendarHome() {
  const navigate = useNavigate();
  const entries = useEntries();
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [dir, setDir] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayKey = toDateKey(today);

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const total = new Date(year, month + 1, 0).getDate();
    const lead = first.getDay();
    const cells: (number | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const monthEntryCount = useMemo(
    () =>
      Object.keys(entries).filter((k) =>
        k.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
      ).length,
    [entries, year, month]
  );

  const shift = (delta: number) => {
    setDir(delta);
    setCursor(new Date(year, month + delta, 1));
  };

  const years = Array.from({ length: 21 }, (_, i) => today.getFullYear() - 10 + i);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-12 pt-8">
      <header className="fade-slide-in mb-7 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-primary">
            Memory Journal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthEntryCount > 0
              ? `${monthEntryCount} ${monthEntryCount === 1 ? "entry" : "entries"} this month`
              : "No entries yet this month"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/entry/$date", params: { date: todayKey } })}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
        >
          <NotebookPen className="size-4" aria-hidden />
          Today
        </button>
      </header>

      <section className="rounded-3xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shift(-1)}
            className="grid size-10 place-items-center rounded-full text-primary transition-colors hover:bg-teal-soft"
          >
            <ChevronLeft className="size-5" />
          </button>

          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            aria-expanded={pickerOpen}
            className="rounded-full px-4 py-1.5 font-display text-lg font-semibold text-foreground transition-colors hover:bg-muted"
          >
            {MONTHS[month]} {year}
          </button>

          <button
            type="button"
            aria-label="Next month"
            onClick={() => shift(1)}
            className="grid size-10 place-items-center rounded-full text-primary transition-colors hover:bg-teal-soft"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {pickerOpen && (
          <div className="fade-slide-in mb-4 grid grid-cols-2 gap-3 rounded-2xl bg-muted p-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Month
              <select
                value={month}
                onChange={(e) => setCursor(new Date(year, Number(e.target.value), 1))}
                className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Year
              <select
                value={year}
                onChange={(e) => setCursor(new Date(Number(e.target.value), month, 1))}
                className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        <div
          key={`${year}-${month}`}
          className="month-animate grid grid-cols-7 gap-1"
          style={{ ["--month-dir" as string]: dir > 0 ? "24px" : "-24px" }}
        >
          {days.map((d, i) => {
            if (d === null) return <div key={`e${i}`} className="aspect-square" />;
            const key = toDateKey(new Date(year, month, d));
            const entry = entries[key];
            const isToday = key === todayKey;
            const mood = entry?.mood ? MOODS.find((m) => m.id === entry.mood) : null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => navigate({ to: "/entry/$date", params: { date: key } })}
                aria-label={`${MONTHS[month]} ${d}${entry ? ", has entry" : ""}`}
                className={`calendar-cell ${
                  isToday
                    ? "bg-sand text-foreground ring-2 ring-ember"
                    : entry
                      ? "bg-secondary text-secondary-foreground"
                      : "text-foreground"
                }`}
              >
                <span>{d}</span>
                <span className="flex h-3 items-center text-[10px] leading-none">
                  {mood ? (
                    mood.emoji
                  ) : entry ? (
                    <span className="block size-1.5 rounded-full bg-ember" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Tap any day to add a photo, mood, and note.
      </p>
    </main>
  );
}
