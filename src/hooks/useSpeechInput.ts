import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in lib.dom for all targets).
type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = { isFinal: boolean; 0: SpeechRecognitionAlternative };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResult };
};
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MAX_RESTARTS = 40;

/**
 * A user-controlled dictation session. The session stays open until the user
 * presses Done — if the browser's recogniser ends itself after a pause (very
 * common on mobile), we quietly restart it and keep appending transcript.
 */
export function useSpeechInput(onFinalText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ref = useRef<RecognitionLike | null>(null);
  const wanted = useRef(false); // true while the user has not pressed Done
  const restarts = useRef(0);
  const lastStart = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onFinalText);
  cb.current = onFinalText;

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => {
      wanted.current = false;
      if (timer.current) clearTimeout(timer.current);
      try {
        ref.current?.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  const launch = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setSupported(false);
      wanted.current = false;
      return;
    }
    try {
      const rec = new Ctor();
      ref.current = rec;
      rec.lang = "en-AU";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (e) => {
        let finalText = "";
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          if (!result) continue;
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) finalText += text;
          else interimText += text;
        }
        setInterim(interimText);
        // A result proves the session is healthy — reset the backoff guard.
        restarts.current = 0;
        if (finalText.trim()) cb.current(finalText.trim());
      };

      rec.onerror = (e) => {
        const kind = e?.error ?? "unknown";
        // Silence-related errors are expected during a long session: keep going.
        if (kind === "no-speech" || kind === "aborted") return;
        if (kind === "not-allowed" || kind === "service-not-allowed") {
          wanted.current = false;
          setListening(false);
          setInterim("");
          setError(
            "Microphone access was blocked. You can still type your list, or use the mic key on your keyboard.",
          );
          return;
        }
        if (kind === "network") {
          setError("Patchy connection — I'll keep trying to listen.");
          return;
        }
        setError(null);
      };

      rec.onend = () => {
        setInterim("");
        // The user hasn't pressed Done, so this end was the browser's idea.
        if (!wanted.current) {
          setListening(false);
          return;
        }
        if (restarts.current >= MAX_RESTARTS) {
          wanted.current = false;
          setListening(false);
          setError("The microphone keeps dropping out. Everything I heard is saved — tap Done or type the rest.");
          return;
        }
        const sinceStart = Date.now() - lastStart.current;
        // Back off when it fails immediately, to avoid a hot restart loop.
        const delay = sinceStart < 500 ? Math.min(3000, 300 * 2 ** restarts.current) : 200;
        restarts.current += 1;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (wanted.current) launch();
        }, delay);
      };

      lastStart.current = Date.now();
      rec.start();
      setListening(true);
    } catch {
      wanted.current = false;
      setListening(false);
      setError("Couldn't start the microphone. Typing works fine too.");
    }
  }, []);

  const start = useCallback(() => {
    setError(null);
    restarts.current = 0;
    wanted.current = true;
    launch();
  }, [launch]);

  /** Called only when the user presses Done. */
  const stop = useCallback(() => {
    wanted.current = false;
    if (timer.current) clearTimeout(timer.current);
    try {
      ref.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
    setInterim("");
  }, []);

  return { supported, listening, interim, error, start, stop };
}
