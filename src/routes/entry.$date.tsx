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
  fileToDataUrl,
  isValidDateKey,
  parseDateKey,
  toDateKey,
  useEntry,
  useSaveEntry,
  type Mood,
} from "@/lib/journal";

export const Route = createFileRoute("/entry/$date")({
  head: ({ params }) => ({
    meta: [
      { title: `Journal Entry — ${params.date} | Memory Journal` },
      {
        name: "description",
        content:
          "Add a photo, pick your mood, and write or dictate your journal entry for this day.",
      },
      { property: "og:title", content: `Journal Entry — ${params.date}` },
      {
        property: "og:description",
        content: "Add a photo, pick your mood, and write or dictate your journal entry.",
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
  const { date } = Route.useParams();
  const navigate = useNavigate();
  const valid = isValidDateKey(date);
  const entry = useEntry(date);
  const save = useSaveEntry();

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
  }, [date]);

  // Debounced autosave of text
  useEffect(() => {
    if (!valid || text === entry.text) return;
    const t = setTimeout(() => {
      save(date, { text });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, date, valid]);

  useEffect(() => () => recognitionRef.current?.stop?.(), []);

  if (!valid) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-xl font-semibold">That date doesn't look right</h1>
        <Link to="/" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Back to calendar
        </Link>
      </main>
    );
  }

  const d = parseDateKey(date);
  const todayKey = toDateKey(new Date());

  const goto = (delta: number) => {
    const next = new Date(d);
    next.setDate(next.getDate() + delta);
    navigate({ to: "/entry/$date", params: { date: toDateKey(next) } });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      save(date, { image: dataUrl });
    } catch {
      setSpeechError("Couldn't read that image. Try another one.");
    }
  };

  const toggleMood = (mood: Mood) => {
    save(date, { mood: entry.mood === mood ? null : mood });
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
          to="/"
          aria-label="Back to calendar"
          className="grid size-10 place-items-center rounded-full text-primary transition-colors hover:bg-teal-soft"
        >
          <ArrowLeft className="size-5" />
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

      <header className="fade-slide-in mt-3 rounded-3xl bg-primary px-6 py-6 text-primary-foreground">
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
                onClick={() => save(date, { image: null })}
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

      {/* Mood */}
      <section className="mt-7">
        <h2 className="mb-2 text-sm font-semibold text-foreground">How was your day?</h2>
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
        {speechError && (
          <p className="mt-2 text-xs text-destructive">{speechError}</p>
        )}
      </section>

      <div className="mt-7 flex gap-2">
        <button
          type="button"
          onClick={() => {
            save(date, { text });
            navigate({ to: "/" });
          }}
          className="flex-1 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
        >
          Save & close
        </button>
        {(entry.text || entry.image || entry.mood) && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this entry?")) {
                save(date, { text: "", image: null, mood: null });
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
