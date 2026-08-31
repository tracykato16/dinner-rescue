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

/**
 * Dictation helper. Appends final transcripts to the caller's text and exposes
 * an interim transcript so the user can see they're being heard.
 * Falls back silently when the browser has no speech recognition.
 */
export function useSpeechInput(onFinalText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<RecognitionLike | null>(null);
  const cb = useRef(onFinalText);
  cb.current = onFinalText;

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => {
      try {
        ref.current?.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  const stop = useCallback(() => {
    try {
      ref.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setError(null);
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
        if (finalText.trim()) cb.current(finalText.trim());
      };

      rec.onerror = (e) => {
        const kind = e?.error ?? "unknown";
        setError(
          kind === "not-allowed" || kind === "service-not-allowed"
            ? "Microphone access was blocked. You can still type, or use your keyboard's mic key."
            : "Speech stopped unexpectedly. Have another go, or type it in.",
        );
        setListening(false);
        setInterim("");
      };

      rec.onend = () => {
        setListening(false);
        setInterim("");
      };

      rec.start();
      setListening(true);
    } catch {
      setError("Couldn't start the microphone. Typing works fine too.");
      setListening(false);
    }
  }, []);

  return { supported, listening, interim, error, start, stop };
}
