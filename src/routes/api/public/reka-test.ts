import { createFileRoute } from "@tanstack/react-router";

// Temporary connectivity check for the Reka AI integration — delete after verifying.
export const Route = createFileRoute("/api/public/reka-test")({
  server: {
    handlers: {
      GET: async () => {
        const apiKey = process.env["REKA_API_KEY"];
        if (!apiKey) return Response.json({ ok: false, error: "REKA_API_KEY missing" });
        const png =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        const res = await fetch("https://api.reka.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
          body: JSON.stringify({
            model: "reka-flash",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "Describe this image in one word." },
                  { type: "image_url", image_url: { url: png } },
                ],
              },
            ],
          }),
        });
        const body = await res.text();
        return Response.json(
          { ok: res.ok, status: res.status, body: body.slice(0, 500) },
          { status: res.ok ? 200 : 502 }
        );
      },
    },
  },
});
