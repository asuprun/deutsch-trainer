'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'tts_voice_name';

// Языковые коды вроде 'de-DE' — не имена голосов, их надо игнорировать
function isRealVoiceName(s: string): boolean {
  return s.length > 0 && !/^[a-z]{2}-[A-Z]{2}$/.test(s);
}

export function useSavedTTS() {
  // Читаем localStorage синхронно, но фильтруем языковые коды
  const [voiceName, setVoiceNameState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY) ?? '';
      return isRealVoiceName(stored) ? stored : '';
    }
    return '';
  });

  useEffect(() => {
    // Всегда синхронизируемся с сервером — он авторитетный источник голоса
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d: { tts_voice?: string }) => {
        const name = d.tts_voice ?? '';
        if (isRealVoiceName(name)) {
          setVoiceNameState(name);
          localStorage.setItem(STORAGE_KEY, name);
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
