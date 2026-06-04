'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useTTS, type TTSStatus } from '@/lib/hooks/use-tts';
import { useSavedTTS } from '@/lib/hooks/use-saved-tts';

type TTSContextType = {
  speak: (text: string, rate?: number) => void;
  cancel: () => void;
  status: TTSStatus;
};

const TTSContext = createContext<TTSContextType | null>(null);

export function TTSProvider({ children }: { children: ReactNode }) {
  const { voiceName } = useSavedTTS();
  const { speak, cancel, status } = useTTS('de-DE', voiceName || undefined);
  return (
    <TTSContext.Provider value={{ speak, cancel, status }}>
      {children}
    </TTSContext.Provider>
  );
}

export function useTTSContext(): TTSContextType {
  const ctx = useContext(TTSContext);
  if (!ctx) throw new Error('useTTSContext must be inside TTSProvider');
  return ctx;
}
