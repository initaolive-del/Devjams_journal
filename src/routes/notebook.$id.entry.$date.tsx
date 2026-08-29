import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Mic,
  Square,
  Trash2,
} from "lucide-react";
import {
  MOODS,
  colorOf,
  fileToDataUrl,
  isValidDateKey,
  parseDateKey,
  toDateKey,
  useEntry,
  useNotebook,
  useNotebookEntries,
  useSaveEntry,
  type Mood,
} from "@/lib/journal";
import { JournalPromptCard } from "@/components/JournalPromptCard";

export const Route = createFileRoute("/notebook/$id/entry/$date")({
  head: ({ params }) => ({
    meta: [
      { title: `Journal Entry — ${params.date} | Memory Journal` },
      {
        name: "description",
        content:
          "Add a photo, log your mood or status, and write or dictate your journal entry for this day.",
      },
      { property: "og:title", content: `Journal Entry — ${params.date}` },
      {
        property: "og:description",
        content: "Add a photo, log your mood or status, and write or dictate your journal entry.",
      },
    ],
  }),
  component: EntryPage,
});

const LONG_DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function EntryPage() {
  const { id, date } = Route.useParams();
  const navigate = useNavigate();
  const notebook = useNotebook(id);
  const valid = isValidDateKey(date);
  const entry = useEntry(id, date);
  const saveEntry = useSaveEntry();
  const allEntries = useNotebookEntries(id);
  const recentTexts = Object.values(allEntries)
    .filter((e) => e.date !== date && e.text.trim())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 3)
    .map((e) => e.text.trim());

  const [text, setText] = useState(entry.text);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef("");

  useEffect(() => {
    setText(entry.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, id]);

  // Debounced autosave of text
  useEffect(() => {
    if (!valid || !notebook || text === entry.text) return;
    const t = setTimeout(() => {
      saveEntry(id, date, { text });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, date, id, valid, notebook]);

  useEffect(() => () => recognitionRef.current?.stop?.(), []);

  if (!notebook || !valid) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-xl font-semibold">
          {notebook ? "That date doesn't look right" : "Notebook not found"}
        </h1>
        <Link to="/" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Back to notebooks
        </Link>
      </main>
    );
  }

  const c = colorOf(notebook.color);
  const d = parseDateKey(date);
  const todayKey = toDateKey(new Date());

  const goto = (delta: number) => {
    const next = new Date(d);
    next.setDate(next.getDate() + delta);
    navigate({ to: "/notebook/$id/entry/$date", params: { id, date: toDateKey(next) } });
  };

  const save = (patch: Parameters<typeof saveEntry>[2]) => saveEntry(id, date, patch);

  const handleFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      save({ image: dataUrl });
    } catch {
      setSpeechError("Couldn't read that image. Try another one.");
    }
  };

  const toggleMood = (mood: Mood) => {
    save({ mood: entry.mood === mood ? null : mood });
  };

  const toggleStatus = (status: 0 | 1) => {
    save({ status: entry.status === status ? null : status });
  };

  const toggleVoice = () => {
    setSpeechError(null);
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSpeechError("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    baseTextRef.current = text ? text.replace(/\s+$/, "") + " " : "";
    rec.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setText(baseTextRef.current + transcript);
    };
    rec.onerror = (e: any) => {
      setSpeechError(
        e.error === "not-allowed"
          ? "Microphone access was blocked."
          : "Voice input stopped unexpectedly."
      );
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-16 pt-6">
      <div className="fade-slide-in flex items-center justify-between">
        <Link
          to="/notebook/$id"
          params={{ id }}
          aria-label="Back to notebook calendar"
          className="flex items-center gap-2 rounded-full px-2 py-1.5 text-primary transition-colors hover:bg-teal-soft"
        >
          <ArrowLeft className="size-5" />
          <span className="max-w-[9rem] truncate text-sm font-semibold">{notebook.name}</span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => goto(-1)}
            className="grid size-10 place-items-center rounded-full text-primary transition-colors hover:bg-teal-soft"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => goto(1)}
            className="grid size-10 place-items-center rounded-full text-primary transition-colors hover:bg-teal-soft"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <header
        className="fade-slide-in mt-3 rounded-3xl px-6 py-6"
        style={{ background: c.swatch, color: c.on }}
      >
        <p className="text-sm font-medium opacity-80">{LONG_DAYS[d.getDay()]}</p>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="font-display text-5xl font-semibold leading-none">{d.getDate()}</span>
          <span className="font-display text-lg opacity-90">
            {LONG_MONTHS[d.getMonth()]} {d.getFullYear()}
          </span>
        </div>
        {date === todayKey && (
          <span className="mt-3 inline-block rounded-full bg-sand px-3 py-1 text-xs font-semibold text-foreground">
            Today
          </span>
        )}
      </header>

      {/* Photo */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Memory photo</h2>
        {entry.image ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <img
              src={entry.image}
              alt={`Memory photo for ${date}`}
              className="max-h-80 w-full object-cover"
              loading="lazy"
            />
            <div className="flex gap-2 p-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex-1 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground transition-transform active:scale-95"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => save({ image: null })}
                className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground transition-transform active:scale-95"
              >
                <Trash2 className="size-4" aria-hidden />
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? "border-ember bg-sand/50" : "border-input bg-card"
            }`}
          >
            <ImagePlus className="size-7 text-accent" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Add a memory photo — drop it here or choose a file
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
              >
                Choose photo
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-transform active:scale-95"
              >
                Take photo
              </button>
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? undefined)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? undefined)}
        />
      </section>

      {/* Mood or status */}
      <section className="mt-7">
        <h2 className="mb-2 text-sm font-semibold text-foreground">How was your day?</h2>
        {notebook.type === "mood" ? (
          <div className="grid grid-cols-4 gap-2">
            {MOODS.map((m) => {
              const active = entry.mood === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleMood(m.id)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs font-medium transition-all active:scale-95 ${
                    active
                      ? "border-ember bg-sand text-foreground shadow-[0_0_0_2px_var(--ember)]"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span className="text-xl leading-none">{m.emoji}</span>
                  {m.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {([0, 1] as const).map((i) => {
              const active = entry.status === i;
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleStatus(i)}
                  className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-3xl border px-4 py-5 text-center text-sm font-semibold transition-all active:scale-95 ${
                    active
                      ? "border-ember bg-sand text-foreground shadow-[0_0_0_2px_var(--ember)]"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    {i === 0 ? "✓" : "○"}
                  </span>
                  {notebook.labels[i]}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Journal */}
      <section className="mt-7">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Journal</h2>
          <span className="text-xs text-muted-foreground">
            {saved ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <Check className="size-3.5" aria-hidden /> Saved
              </span>
            ) : (
              `${words} ${words === 1 ? "word" : "words"}`
            )}
          </span>
        </div>
        {!text.trim() && (
          <JournalPromptCard
            notebookId={id}
            notebookName={notebook.name}
            notebookType={notebook.type}
            date={date}
            dayLabel={`${LONG_DAYS[d.getDay()]}, ${LONG_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`}
            recent={recentTexts}
            onUse={(p) => setText(p + "\n\n")}
          />
        )}
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="What do you want to remember about today?"
            className="w-full resize-y rounded-2xl border border-input bg-card p-4 pb-14 text-[15px] leading-relaxed text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={listening}
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            className={`absolute bottom-4 left-3 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-transform active:scale-95 ${
              listening
                ? "mic-listening bg-ember text-ember-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {listening ? <Square className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
            {listening ? "Listening…" : "Speak"}
          </button>
        </div>
        {speechError && <p className="mt-2 text-xs text-destructive">{speechError}</p>}
      </section>

      <div className="mt-7 flex gap-2">
        <button
          type="button"
          onClick={() => {
            save({ text });
            navigate({ to: "/notebook/$id", params: { id } });
          }}
          className="flex-1 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
        >
          Save & close
        </button>
        {(entry.text || entry.image || entry.mood || entry.status !== null) && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this entry?")) {
                save({ text: "", image: null, mood: null, status: null });
                setText("");
              }
            }}
            className="rounded-full bg-muted px-5 py-3 text-sm font-semibold text-muted-foreground transition-transform active:scale-95"
          >
            Clear
          </button>
        )}
      </div>
    </main>
  );
}
