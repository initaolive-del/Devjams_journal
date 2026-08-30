import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  notebookName: z.string().min(1).max(120),
  monthLabel: z.string().min(1).max(80),
  photos: z
    .array(
      z.object({
        date: z.string(),
        dataUrl: z.string().startsWith("data:image/"),
      })
    )
    .min(1)
    .max(12),
});

export const generatePhotoSummary = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this app.");

    const instruction = [
      `These photos come from someone's personal journal "${data.notebookName}", taken across ${data.monthLabel}.`,
      `Dates, in order: ${data.photos.map((p) => p.date).join(", ")}.`,
      "In 2-4 warm, observational sentences, describe the overall feeling, moments or themes you notice across them.",
      "Don't assume specific events you can't see, don't be generic, and avoid clinical or analytical language — write like a thoughtful friend reflecting back what they noticed.",
      "If there are only one or two photos, still say something meaningful and specific about what's there, without pretending to see a whole month.",
      "Reply as json with this shape: {\"summary\": string, \"tags\": string[]} where tags are 2-4 very short theme phrases (2-4 words each, no full sentences). Use an empty array if no clear themes stand out.",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              ...data.photos.map((p) => ({
                type: "image_url" as const,
                image_url: { url: p.dataUrl },
              })),
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Too many requests right now — try again shortly.");
      if (res.status === 402)
        throw new Error("AI credits are exhausted. Add credits in Lovable to keep generating.");
      throw new Error(detail.slice(0, 200) || "Photo summary failed.");
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("The AI returned an empty summary — try again.");

    let summary = raw;
    let tags: string[] = [];
    try {
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned) as { summary?: string; tags?: unknown };
      if (typeof parsed.summary === "string" && parsed.summary.trim()) summary = parsed.summary.trim();
      if (Array.isArray(parsed.tags))
        tags = parsed.tags
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 4);
    } catch {
      // fall back to the raw text
    }

    return { summary, tags };
  });
