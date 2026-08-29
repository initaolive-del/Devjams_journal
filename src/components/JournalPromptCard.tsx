import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { generateJournalPrompt } from "@/lib/prompt.functions";
import type { NotebookType } from "@/lib/journal";

const FALLBACKS: Record<NotebookType, string[]> = {
  mood: [
    "What small moment today deserves a second look?",
    "Which feeling stayed with you the longest today, and why?",
    "What did today ask of you that you didn't expect?",
    "Who or what made today lighter?",
    "If today had a colour, which one would it be?",
  ],
  status: [
    "What moved forward today, even slightly?",
    "What got in the way today, and what would help tomorrow?",
    "What's the smallest next step you can take this week?",
    "Where did you spend your best energy today?",
    "What would make tomorrow feel like progress?",
  ],
};

const CACHE_KEY = "memory-journal-prompts-v1";

function readCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writeCache(key: string, value: string) {
  try {
    const c = readCache();
    c[key] = value;
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

function randomFallback(type: NotebookType, exclude?: string) {
  const list = FALLBACKS[type].filter((p) => p !== exclude);
  return list[Math.floor(Math.random() * list.length)]!;
}

export function JournalPromptCard({
  notebookId,
  notebookName,
  notebookType,
  date,
  dayLabel,
  recent,
  onUse,
}: {
  notebookId: string;
  notebookName: string;
  notebookType: NotebookType;
  date: string;
  dayLabel: string;
  recent: string[];
  onUse: (prompt: string) => void;
}) {
  const cacheKey = `${notebookId}::${date}`;
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const recentRef = useRef(recent);
  recentRef.current = recent;

  const fetchPrompt = useCallback(
    async (force: boolean) => {
      if (!force) {
        const cached = readCache()[cacheKey];
        if (cached) {
          setPrompt(cached);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      try {
        const res = await generateJournalPrompt({
          data: {
            notebookName,
            notebookType,
            dayLabel,
            recent: recentRef.current.slice(0, 3),
          },
        });
        setPrompt(res.prompt);
        writeCache(cacheKey, res.prompt);
      } catch {
        const fb = randomFallback(notebookType, prompt ?? undefined);
        setPrompt(fb);
        writeCache(cacheKey, fb);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, notebookName, notebookType, dayLabel]
  );

  useEffect(() => {
    void fetchPrompt(false);
  }, [fetchPrompt]);

  return (
    <div className="mb-2 flex items-start gap-2 rounded-2xl border border-border bg-teal-soft/60 px-3.5 py-3">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      {loading ? (
        <div className="flex-1 space-y-2 py-1" aria-label="Generating a writing prompt">
          <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-border" />
          <div className="h-2.5 w-2/5 animate-pulse rounded-full bg-border" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => prompt && onUse(prompt)}
          className="flex-1 text-left text-[14px] italic leading-relaxed text-secondary-foreground transition-opacity hover:opacity-80"
        >
          {prompt}
        </button>
      )}
      <button
        type="button"
        onClick={() => void fetchPrompt(true)}
        disabled={loading}
        aria-label="Get a new idea"
        title="New idea"
        className="grid size-8 shrink-0 place-items-center rounded-full text-primary transition-colors hover:bg-secondary disabled:opacity-50"
      >
        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
      </button>
    </div>
  );
}
