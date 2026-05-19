'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'tts_voice_name';

export function useSavedTTS() {
  const [voiceName, setVoiceNameState] = useState<string>('');

  useEffect(() => {
    // Сначала пробуем localStorage
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      setVoiceNameState(local);
      return;
    }
    // Затем синхронизируем с сервером
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d: { tts_voice?: string }) => {
        if (d.tts_voice) {
          setVoiceNameState(d.tts_voice);
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
