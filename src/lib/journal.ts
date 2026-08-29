import { useCallback, useMemo, useSyncExternalStore } from "react";

export type Mood =
  | "happy"
  | "calm"
  | "grateful"
  | "excited"
  | "tired"
  | "anxious"
  | "sad"
  | "angry";

export type NotebookType = "mood" | "status";

export interface Notebook {
  id: string;
  name: string;
  icon: string; // emoji
  color: NotebookColor;
  type: NotebookType;
  labels: [string, string]; // status labels (used when type === "status")
  createdAt: number;
}

export interface JournalEntry {
  date: string; // YYYY-MM-DD
  notebookId: string;
  text: string;
  mood: Mood | null;
  /** 0 or 1 for status notebooks (index into notebook.labels) */
  status: 0 | 1 | null;
  image: string | null; // data URL
  updatedAt: number;
}

export type NotebookColor = "teal" | "brightTeal" | "sand" | "ember";

export const NOTEBOOK_COLORS: {
  id: NotebookColor;
  label: string;
  swatch: string;
  soft: string;
  on: string;
}[] = [
  { id: "teal", label: "Deep teal", swatch: "var(--primary)", soft: "var(--teal-soft)", on: "var(--primary-foreground)" },
  { id: "brightTeal", label: "Bright teal", swatch: "var(--accent)", soft: "var(--secondary)", on: "var(--accent-foreground)" },
  { id: "sand", label: "Cream", swatch: "var(--sand)", soft: "var(--sand)", on: "var(--foreground)" },
  { id: "ember", label: "Ember", swatch: "var(--ember)", soft: "oklch(0.93 0.05 60)", on: "var(--ember-foreground)" },
];

export function colorOf(color: NotebookColor) {
  return NOTEBOOK_COLORS.find((c) => c.id === color) ?? NOTEBOOK_COLORS[0]!;
}

export const NOTEBOOK_ICONS = ["📓", "🌿", "☀️", "🌙", "💪", "📚", "🎧", "🍳", "✈️", "❤️", "🧠", "🎯"];

export const DEFAULT_STATUS_LABELS: [string, string] = ["Progressed", "Didn't Progress"];

export type PeriodType = "weekly" | "monthly";

export interface SummaryEntry {
  id: string;
  parentNotebookId: string;
  periodType: PeriodType;
  periodLabel: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  summaryText: string;
  generatedAt: number;
  breakdown: { label: string; count: number }[];
}

const KEY = "memory-journal-v2";
const LEGACY_KEY = "memory-journal-entries-v1";

interface Store {
  notebooks: Notebook[];
  entries: Record<string, JournalEntry>; // key: `${notebookId}::${date}`
  summaries: SummaryEntry[];
}

const empty: Store = { notebooks: [], entries: {}, summaries: [] };


let cache: Store | null = null;
const listeners = new Set<() => void>();

function entryKey(notebookId: string, date: string) {
  return `${notebookId}::${date}`;
}

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function migrateLegacy(): Store | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const old = JSON.parse(raw) as Record<string, Omit<JournalEntry, "notebookId" | "status">>;
    const keys = Object.keys(old);
    if (!keys.length) return null;
    const nb: Notebook = {
      id: newId(),
      name: "My Journal",
      icon: "📓",
      color: "teal",
      type: "mood",
      labels: DEFAULT_STATUS_LABELS,
      createdAt: Date.now(),
    };
    const entries: Store["entries"] = {};
    for (const k of keys) {
      const e = old[k]!;
      entries[entryKey(nb.id, k)] = { ...e, notebookId: nb.id, status: null };
    }
    return { notebooks: [nb], entries, summaries: [] };
  } catch {
    return null;
  }
}

function readStore(): Store {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      cache = {
        notebooks: parsed.notebooks ?? [],
        entries: parsed.entries ?? {},
        summaries: parsed.summaries ?? [],
      };
    } else {
      cache = migrateLegacy() ?? { notebooks: [], entries: {}, summaries: [] };
      if (cache.notebooks.length) persist(cache);
    }
  } catch {
    cache = { notebooks: [], entries: {}, summaries: [] };
  }
  return cache;
}

function persist(next: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full (large images) — keep in-memory copy
  }
}

function writeStore(next: Store) {
  cache = next;
  persist(next);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return readStore();
}

function useStore(): Store {
  return useSyncExternalStore(subscribe, getSnapshot, () => empty);
}

export interface NotebookSummary extends Notebook {
  entryCount: number;
  lastUpdated: number;
}

export function useNotebooks(): NotebookSummary[] {
  const store = useStore();
  return useMemo(() => {
    const counts = new Map<string, { n: number; last: number }>();
    for (const e of Object.values(store.entries)) {
      if (!hasContent(e)) continue;
      const c = counts.get(e.notebookId) ?? { n: 0, last: 0 };
      c.n += 1;
      c.last = Math.max(c.last, e.updatedAt);
      counts.set(e.notebookId, c);
    }
    return store.notebooks.map((n) => ({
      ...n,
      entryCount: counts.get(n.id)?.n ?? 0,
      lastUpdated: counts.get(n.id)?.last ?? n.createdAt,
    }));
  }, [store]);
}

export function useNotebook(id: string): Notebook | undefined {
  const store = useStore();
  return store.notebooks.find((n) => n.id === id);
}

export function hasContent(e: JournalEntry | undefined): boolean {
  return !!e && (!!e.text.trim() || !!e.image || e.mood !== null || e.status !== null);
}

/** All entries of a notebook, keyed by date. */
export function useNotebookEntries(notebookId: string): Record<string, JournalEntry> {
  const store = useStore();
  return useMemo(() => {
    const out: Record<string, JournalEntry> = {};
    for (const e of Object.values(store.entries)) {
      if (e.notebookId === notebookId && hasContent(e)) out[e.date] = e;
    }
    return out;
  }, [store, notebookId]);
}

export function useEntry(notebookId: string, date: string): JournalEntry {
  const store = useStore();
  return (
    store.entries[entryKey(notebookId, date)] ?? {
      date,
      notebookId,
      text: "",
      mood: null,
      status: null,
      image: null,
      updatedAt: 0,
    }
  );
}

export function useSaveEntry() {
  return useCallback(
    (
      notebookId: string,
      date: string,
      patch: Partial<Omit<JournalEntry, "date" | "notebookId">>
    ) => {
      const store = readStore();
      const k = entryKey(notebookId, date);
      const prev = store.entries[k] ?? {
        date,
        notebookId,
        text: "",
        mood: null,
        status: null,
        image: null,
        updatedAt: 0,
      };
      writeStore({
        ...store,
        entries: { ...store.entries, [k]: { ...prev, ...patch, updatedAt: Date.now() } },
      });
    },
    []
  );
}

export function useCreateNotebook() {
  return useCallback((data: Omit<Notebook, "id" | "createdAt">) => {
    const store = readStore();
    const nb: Notebook = { ...data, id: newId(), createdAt: Date.now() };
    writeStore({ ...store, notebooks: [...store.notebooks, nb] });
    return nb;
  }, []);
}

export function useUpdateNotebook() {
  return useCallback((id: string, patch: Partial<Omit<Notebook, "id" | "createdAt">>) => {
    const store = readStore();
    writeStore({
      ...store,
      notebooks: store.notebooks.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    });
  }, []);
}

export function useDeleteNotebook() {
  return useCallback((id: string) => {
    const store = readStore();
    const entries: Store["entries"] = {};
    for (const [k, v] of Object.entries(store.entries)) {
      if (v.notebookId !== id) entries[k] = v;
    }
    writeStore({ notebooks: store.notebooks.filter((n) => n.id !== id), entries });
  }, []);
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = parseDateKey(key);
  return !Number.isNaN(d.getTime()) && toDateKey(d) === key;
}

export function relativeTime(ts: number): string {
  if (!ts) return "No entries yet";
  const diff = Date.now() - ts;
  const day = 86400000;
  if (diff < day) return "Updated today";
  const days = Math.floor(diff / day);
  if (days === 1) return "Updated yesterday";
  if (days < 30) return `Updated ${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "Updated last month" : `Updated ${months} months ago`;
}

export const MOODS: { id: Mood; label: string; emoji: string }[] = [
  { id: "happy", label: "Happy", emoji: "😊" },
  { id: "calm", label: "Calm", emoji: "😌" },
  { id: "grateful", label: "Grateful", emoji: "🙏" },
  { id: "excited", label: "Excited", emoji: "🤩" },
  { id: "tired", label: "Tired", emoji: "😴" },
  { id: "anxious", label: "Anxious", emoji: "😰" },
  { id: "sad", label: "Sad", emoji: "😢" },
  { id: "angry", label: "Angry", emoji: "😠" },
];

/** Downscale + compress an image file to a JPEG data URL for localStorage. */
export function fileToDataUrl(file: File, maxSize = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}
