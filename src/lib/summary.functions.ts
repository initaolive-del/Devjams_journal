import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  notebookName: z.string().min(1).max(120),
  notebookType: z.enum(["mood", "status"]),
  periodLabel: z.string().min(1).max(80),
  entries: z
    .array(
      z.object({
        date: z.string(),
        text: z.string(),
        marker: z.string(),
      })
    )
    .min(1)
    .max(120),
});

export const generateNotebookSummary = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this app.");

    const lines = data.entries
      .map(
        (e) =>
          `- ${e.date}${e.marker ? ` [${e.marker}]` : ""}: ${e.text.trim() || "(no written note)"}`
      )
      .join("\n");

    const prompt = [
      `Notebook: "${data.notebookName}" (${
        data.notebookType === "mood" ? "mood tracking" : "status / progress tracking"
      })`,
      `Period: ${data.periodLabel}`,
      "",
      "Entries:",
      lines,
      "",
      "Write a warm, concise summary of this period for the person who wrote these entries.",
      "Speak to them as 'you'. 100-160 words, plain prose in 1-2 short paragraphs, no headings, no bullet points, no markdown.",
      "Cover the recurring themes, one or two notable moments, and",
      data.notebookType === "status"
        ? "an honest sense of overall progress and trend."
        : "the overall emotional arc of the period.",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-terra",
        input: prompt,
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Too many requests right now — try again shortly.");
      if (res.status === 402)
        throw new Error("AI credits are exhausted. Add credits in Lovable to keep generating.");
      throw new Error(detail.slice(0, 200) || "Summary generation failed.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload) as {
              type?: string;
              delta?: string;
              response?: { output_text?: string };
            };
            if (evt.type === "response.output_text.delta" && evt.delta) text += evt.delta;
            else if (evt.type === "response.completed" && evt.response?.output_text)
              text = evt.response.output_text;
          } catch {
            // ignore malformed keep-alive chunks
          }
        }
      }
    }

    const summaryText = text.trim();
    if (!summaryText) throw new Error("The AI returned an empty summary — try again.");
    return { summaryText };
  });
