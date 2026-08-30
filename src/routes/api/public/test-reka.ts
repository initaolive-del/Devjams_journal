import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY debug endpoint — remove after diagnosing the Reka photo summary error.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export const Route = createFileRoute("/api/public/test-reka")({
  server: {
    handlers: {
      GET: async () => {
        const apiKey = process.env["REKA_API_KEY"];
        if (!apiKey) return Response.json({ error: "REKA_API_KEY not set" }, { status: 500 });

        const res = await fetch("https://api.reka.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
          body: JSON.stringify({
            model: "reka-flash",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "Describe this image in one sentence." },
                  { type: "image_url", image_url: { url: TINY_PNG } },
                ],
              },
            ],
          }),
        });
        const text = await res.text();
        return Response.json({ status: res.status, body: text.slice(0, 2000) });
      },
    },
  },
});
