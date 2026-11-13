"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Speech-to-text with the browser's built-in recognition (Chrome, Edge, Safari). Firefox has none,
// so `supported` is false there and the mic button is hidden.

interface RecognitionResult {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings to talk.",
  "service-not-allowed": "Microphone access is blocked. Allow it in your browser's site settings to talk.",
  "no-speech": "I didn't hear anything. Tap the mic and try again.",
  "audio-capture": "No microphone was found.",
  network: "Voice input needs an internet connection.",
};

/**
 * Listens for one spoken question. `transcript` updates while the person talks; `onFinal` gets the
 * whole sentence once they stop.
 */
export function useVoiceInput(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const finalText = useRef("");
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  // Known only in the browser, after hydration.
  useEffect(() => {
    const id = window.setTimeout(() => setSupported(recognitionClass() !== null), 0);
    return () => {
      window.clearTimeout(id);
      recognition.current?.abort();
    };
  }, []);

  const start = useCallback(() => {
    const Rec = recognitionClass();
    if (!Rec || recognition.current) return;
    window.speechSynthesis?.cancel(); // don't listen to our own voice
    const rec = new Rec();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    finalText.current = "";
    setTranscript("");
    setError(null);
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText.current += result[0].transcript;
        else interim += result[0].transcript;
      }
      setTranscript((finalText.current + interim).trim());
    };
    rec.onerror = (event) => {
      if (event.error !== "aborted") setError(ERRORS[event.error] ?? "Voice input stopped. Please try again.");
    };
    rec.onend = () => {
      recognition.current = null;
      setListening(false);
      const text = finalText.current.trim();
      if (text) onFinalRef.current(text);
    };
    recognition.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recognition.current = null;
      setListening(false);
      setError("Voice input couldn't start. Please try again.");
    }
  }, []);

  const stop = useCallback(() => recognition.current?.stop(), []);

  return { supported, listening, transcript, error, start, stop };
}
