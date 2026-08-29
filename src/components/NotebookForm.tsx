import { useState } from "react";
import {
  DEFAULT_STATUS_LABELS,
  NOTEBOOK_COLORS,
  NOTEBOOK_ICONS,
  colorOf,
  type Notebook,
  type NotebookColor,
  type NotebookType,
} from "@/lib/journal";

export interface NotebookDraft {
  name: string;
  icon: string;
  color: NotebookColor;
  type: NotebookType;
  labels: [string, string];
}

export function NotebookForm({
  initial,
  lockType,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Notebook;
  lockType?: boolean;
  submitLabel: string;
  onSubmit: (draft: NotebookDraft) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? NOTEBOOK_ICONS[0]!);
  const [color, setColor] = useState<NotebookColor>(initial?.color ?? "teal");
  const [type, setType] = useState<NotebookType>(initial?.type ?? "mood");
  const [labels, setLabels] = useState<[string, string]>(
    initial?.labels ?? DEFAULT_STATUS_LABELS
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      icon,
      color,
      type,
      labels: [
        labels[0].trim() || DEFAULT_STATUS_LABELS[0],
        labels[1].trim() || DEFAULT_STATUS_LABELS[1],
      ],
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Notebook name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Daily Moods, Gym, Reading"
          autoFocus
          className="rounded-xl border border-input bg-card px-4 py-3 text-[15px] text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Icon
        </span>
        <div className="grid grid-cols-6 gap-2">
          {NOTEBOOK_ICONS.map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={i === icon}
              onClick={() => setIcon(i)}
              className={`grid aspect-square place-items-center rounded-xl border text-xl transition-transform active:scale-95 ${
                i === icon ? "border-ember bg-sand" : "border-border bg-card hover:bg-muted"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Colour
        </span>
        <div className="flex gap-3">
          {NOTEBOOK_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.label}
              aria-pressed={c.id === color}
              onClick={() => setColor(c.id)}
              className={`size-10 rounded-full border-2 transition-transform active:scale-90 ${
                c.id === color ? "border-foreground" : "border-transparent"
              }`}
              style={{ background: c.swatch }}
            />
          ))}
        </div>
      </div>

      {!lockType && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What do you track?
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "mood", title: "Mood", hint: "8 emoji moods" },
                { id: "status", title: "Status", hint: "Two custom options" },
              ] as const
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={type === o.id}
                onClick={() => setType(o.id)}
                className={`rounded-2xl border px-4 py-3 text-left transition-all active:scale-95 ${
                  type === o.id
                    ? "border-ember bg-sand text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="block text-sm font-semibold">{o.title}</span>
                <span className="block text-xs opacity-80">{o.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {type === "status" && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status labels
          </span>
          <input
            value={labels[0]}
            onChange={(e) => setLabels([e.target.value, labels[1]])}
            placeholder={DEFAULT_STATUS_LABELS[0]}
            className="rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={labels[1]}
            onChange={(e) => setLabels([labels[0], e.target.value])}
            placeholder={DEFAULT_STATUS_LABELS[1]}
            className="rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex-1 rounded-full px-5 py-3 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50"
          style={{ background: colorOf(color).swatch, color: colorOf(color).on }}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-muted px-5 py-3 text-sm font-semibold text-muted-foreground transition-transform active:scale-95"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
