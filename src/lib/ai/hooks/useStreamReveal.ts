'use client';

import { useEffect, useState } from 'react';

export function useStreamReveal(text: string, charsPerTick = 3, intervalMs = 18) {
  const [state, setState] = useState<{ text: string; chars: number }>({
    text,
    chars: 0,
  });

  if (state.text !== text) {
    setState({ text, chars: 0 });
  }

  useEffect(() => {
    if (!text) return;
    const id = setInterval(() => {
      setState((prev) => {
        if (prev.text !== text) return prev;
        const next = Math.min(text.length, prev.chars + charsPerTick);
        if (next === prev.chars) {
          clearInterval(id);
          return prev;
        }
        return { text, chars: next };
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [text, charsPerTick, intervalMs]);

  const visible = state.text === text ? text.slice(0, state.chars) : '';
  return { visible, done: visible.length === text.length };
}
