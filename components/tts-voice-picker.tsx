'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  value: string;
  onChange: (name: string) => void;
  lang?: string;
};

const TEST_PHRASE = 'Guten Tag! Wie geht es Ihnen?';

export function TtsVoicePicker({ value, onChange, lang = 'de-DE' }: Props) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    setSupported(true);

    const update = () => {
      const all = window.speechSynthesis.getVoices();
      const langPrefix = lang.split('-')[0];
      const filtered = all.filter(
        (v) => v.lang === lang || v.lang.startsWith(langPrefix + '-') || v.lang === langPrefix,
      );
      setVoices(filtered);
    };

    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, [lang]);

  function handleTest() {
    if (!supported) return;
    const utt = new SpeechSynthesisUtterance(TEST_PHRASE);
    utt.lang = lang;
    if (value) {
      const all = window.speechSynthesis.getVoices();
      const found = all.find((v) => v.name === value);
      if (found) utt.voice = found;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  }

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Браузер не поддерживает Web Speech API.
      </p>
    );
  }

  if (voices.length === 0) {
    return (
      <p className="text-sm text-amber-500">
        Голоса для языка {lang} не найдены. Возможно, они загружаются или не установлены в системе.
      </p>
    );
  }

  const currentValue = value || voices[0]?.name || '';

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentValue}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {voices.map((v) => (
          <option key={v.name} value={v.name}>
            {v.name} ({v.lang})
          </option>
        ))}
      </select>
      <Button type="button" variant="outline" size="sm" onClick={handleTest}>
        ▶ Тест
      </Button>
    </div>
  );
}
