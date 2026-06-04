'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'tts_voice_name';

export function useSavedTTS() {
  // Читаем localStorage синхронно при первом рендере —
  // иначе useTTS успевает отработать с пустым voiceName и выбирает рандомный голос
  const [voiceName, setVoiceNameState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) ?? '';
    }
    return '';
  });

  useEffect(() => {
    // Если в localStorage ничего нет — пробуем сервер
    if (voiceName) return;
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d: { tts_voice?: string }) => {
        if (d.tts_voice) {
          setVoiceNameState(d.tts_voice);
          localStorage.setItem(STORAGE_KEY, d.tts_voice);
        }
      })
      .catch(() => {});
  }, []);

  function setVoiceName(name: string) {
    setVoiceNameState(name);
    localStorage.setItem(STORAGE_KEY, name);
  }

  return { voiceName, setVoiceName };
}
