import { useCallback, useSyncExternalStore } from "react";

export type Mood =
  | "happy"
  | "calm"
  | "grateful"
  | "excited"
  | "tired"
  | "anxious"
  | "sad"
  | "angry";

export interface JournalEntry {
  date: string; // YYYY-MM-DD
  text: string;
  mood: Mood | null;
  image: string | null; // data URL
  updatedAt: number;
}

const KEY = "memory-journal-entries-v1";

type Store = Record<string, JournalEntry>;

let cache: Store | null = null;
const listeners = new Set<() => void>();

function readStore(): Store {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || "{}") as Store;
  } catch {
    cache = {};
  }
  return cache;
}

function writeStore(next: Store) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full (large images) — keep in-memory copy
  }
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

export function useEntries(): Store {
  return useSyncExternalStore(subscribe, getSnapshot, () => ({} as Store));
}

export function useEntry(date: string): JournalEntry {
  const entries = useEntries();
  return (
    entries[date] ?? { date, text: "", mood: null, image: null, updatedAt: 0 }
  );
}

export function useSaveEntry() {
  return useCallback((date: string, patch: Partial<Omit<JournalEntry, "date">>) => {
    const store = readStore();
    const prev = store[date] ?? {
      date,
      text: "",
      mood: null,
      image: null,
      updatedAt: 0,
    };
    writeStore({ ...store, [date]: { ...prev, ...patch, updatedAt: Date.now() } });
  }, []);
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = parseDateKey(key);
  return !Number.isNaN(d.getTime()) && toDateKey(d) === key;
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
