import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "recording" | "transcribing";

function pickMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

/**
 * One continuous recording from Start until the user presses Done — no
 * auto-restarting recogniser, so no repeated Android microphone beeps and
 * silence is never mistaken for "finished". The completed audio is transcribed
 * once, server-side.
 */
export function useKitchenRecorder(onTranscript: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const cb = useRef(onTranscript);
  cb.current = onTranscript;

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        typeof MediaRecorder !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia,
    );
    return () => {
      if (ticker.current) clearInterval(ticker.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const cleanup = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recorder.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setSeconds(0);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = rec;
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = async () => {
        const type = rec.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        cleanup();
        if (blob.size < 2048) {
          setPhase("idle");
          setError("I didn't hear anything — have another go, or type your list.");
          return;
        }
        setPhase("transcribing");
        try {
          const form = new FormData();
          form.append("audio", blob, "kitchen");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const payload = (await res.json().catch(() => ({}))) as {
            text?: string;
            error?: string;
          };
          if (!res.ok || !payload.text) {
            setError(payload.error ?? "I couldn't make out that recording. Try again or type it.");
          } else {
            cb.current(payload.text);
          }
        } catch {
          setError("Couldn't send that recording. Check your connection and try again.");
        } finally {
          setPhase("idle");
        }
      };
      // No timeslice: one complete, decodable file for the whole session.
      rec.start();
      setPhase("recording");
      ticker.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      cleanup();
      setPhase("idle");
      setError(
        "I couldn't get to the microphone. You can still type your list, or use the mic key on your keyboard.",
      );
    }
  }, [cleanup]);

  /** Only ever called when the user presses Done. */
  const stop = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else setPhase("idle");
  }, []);

  return { supported, phase, seconds, error, start, stop, clearError: () => setError(null) };
}
