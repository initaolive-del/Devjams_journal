import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  notebookName: z.string().min(1).max(120),
  notebookType: z.enum(["mood", "status"]),
  dayLabel: z.string().min(1).max(60),
  recent: z.array(z.string().max(400)).max(3),
});

export const generateJournalPrompt = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this app.");

    const context = data.recent.length
      ? `Recent entries from this notebook (most recent first, for light continuity only):\n${data.recent
          .map((r) => `- ${r.slice(0, 300)}`)
          .join("\n")}`
      : "There are no recent entries yet.";

    const prompt = [
      `Generate one short, warm, specific journal prompt for a ${
        data.notebookType === "mood" ? "mood-tracking (emotionally reflective)" : "status/progress-tracking (goal-oriented)"
      } notebook called "${data.notebookName}".`,
      `Today is ${data.dayLabel}.`,
      context,
      "",
      "Keep it to ONE sentence, no generic clichés, personal rather than templated.",
      "Reply with the prompt sentence only — no quotes, no preamble.",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-luna",
        input: prompt,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Too many requests right now — try again shortly.");
      if (res.status === 402) throw new Error("AI credits are exhausted.");
      throw new Error(detail.slice(0, 200) || "Prompt generation failed.");
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
            // ignore keep-alive chunks
          }
        }
      }
    }

    const promptText = text.trim().replace(/^["'“”]|["'“”]$/g, "");
    if (!promptText) throw new Error("Empty prompt.");
    return { prompt: promptText };
  });
