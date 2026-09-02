import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 20 * 1024 * 1024;

const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return Response.json({ error: "Transcription is not configured." }, { status: 500 });
        }

        let file: File | null = null;
        try {
          const form = await request.formData();
          const value = form.get("audio");
          if (value instanceof File) file = value;
        } catch {
          return Response.json({ error: "Couldn't read that recording." }, { status: 400 });
        }

        if (!file || file.size === 0) {
          return Response.json({ error: "That recording was empty." }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return Response.json(
            { error: "That recording is too long — try a shorter run through the kitchen." },
            { status: 413 },
          );
        }

        const mime = (file.type || "audio/webm").split(";")[0] ?? "audio/webm";
        const ext = EXT[mime] ?? "webm";

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        upstream.append("file", file, `kitchen.${ext}`);
        upstream.append("language", "en");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstream,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error("transcription failed", res.status, body);
          const message =
            res.status === 402
              ? "The AI credits for this prototype have run out."
              : res.status === 429
                ? "Bit busy right now — try that again in a moment."
                : "I couldn't make out that recording. Have another go, or type your list.";
          return Response.json({ error: message }, { status: res.status });
        }

        const payload = (await res.json()) as { text?: string };
        return Response.json({ text: (payload.text ?? "").trim() });
      },
    },
  },
});
