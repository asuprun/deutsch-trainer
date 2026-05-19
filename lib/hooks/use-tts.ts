'use client';

import { useCallback, useEffect, useState } from 'react';

export type TTSStatus = {
  supported: boolean;
  hasVoice: boolean;
  voiceName: string | null;
  speaking: boolean;
};

export function useTTS(lang = 'de-DE', voiceName?: string) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const update = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voiceName) {
        const byName = voices.find((v) => v.name === voiceName);
        const fallbackExact = voices.find((v) => v.lang === lang);
        const fallbackPartial = voices.find((v) => v.lang.startsWith(lang.split('-')[0]));
        setVoice(byName ?? fallbackExact ?? fallbackPartial ?? null);
      } else {
        const exact = voices.find((v) => v.lang === lang);
        const partial = voices.find((v) => v.lang.startsWith(lang.split('-')[0]));
        setVoice(exact ?? partial ?? null);
      }
    };

    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, [lang, voiceName]);

  const speak = useCallback(
    (text: string, rate = 1.0) => {
      if (!supported || !text) return;
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = lang;
      utt.rate = rate;
      if (voice) utt.voice = voice;
      utt.onstart = () => setSpeaking(true);
      utt.onend = () => setSpeaking(false);
      utt.onerror = () => setSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
    },
    [voice, supported, lang],
  );

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return {
    speak,
    cancel,
    status: {
      supported,
      hasVoice: voice !== null,
      voiceName: voice?.name ?? null,
      speaking,
    } as TTSStatus,
  };
}
