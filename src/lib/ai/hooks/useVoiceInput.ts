'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// The Web Speech API isn't in the default TS DOM lib, so we declare the
// minimal surface we use. Chrome/Edge/Safari expose it (Safari + older Chrome
// under the webkit- prefix); Firefox does not, which `supported` handles.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: { length: number } & Record<number, SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: Event) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Dictation via the browser's native SpeechRecognition. Finalized transcript
 * segments are pushed to `onTranscript` as they arrive; the caller appends them
 * to the composer. Recording continues until `stop()` (or `toggle()`) is called.
 */
export function useVoiceInput(lang: string, onTranscript: (text: string) => void) {
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [recording, setRecording] = useState(false);
  // Support is fixed for the session; compute once.
  const [supported] = useState(() => getRecognitionCtor() !== null);

  // Keep the latest callback without re-creating start().
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recRef.current) return;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (e) => {
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
      }
      if (finalText.trim()) onTranscriptRef.current(finalText.trim());
    };
    rec.onend = () => {
      recRef.current = null;
      setRecording(false);
    };
    rec.onerror = () => {
      recRef.current = null;
      setRecording(false);
    };

    recRef.current = rec;
    rec.start();
    setRecording(true);
  }, [lang]);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  // Abort any in-flight recognition on unmount.
  useEffect(
    () => () => {
      recRef.current?.abort();
      recRef.current = null;
    },
    [],
  );

  return { supported, recording, start, stop, toggle };
}
