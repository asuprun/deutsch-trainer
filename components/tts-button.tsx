'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTTS } from '@/lib/hooks/use-tts';
import { cn } from '@/lib/utils';

type Props = {
  text: string;
  rate?: number;
  className?: string;
  size?: 'default' | 'sm' | 'icon';
  autoPlay?: boolean;
};

export function TTSButton({ text, rate = 1, className, size = 'icon', autoPlay = false }: Props) {
  const { speak, status } = useTTS();

  if (!status.supported) {
    return (
      <Button variant="ghost" size={size} disabled title="TTS не поддерживается в этом браузере">
        <VolumeX className="size-4" />
      </Button>
    );
  }

  if (autoPlay) {
    // Воспроизведение должно быть инициировано пользовательским действием,
    // поэтому autoPlay просто пред-вызывает speak один раз при mount.
    // Однако в браузерах с строгой политикой автозапуска это может не сработать.
    setTimeout(() => speak(text, rate), 50);
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={() => speak(text, rate)}
      title={status.hasVoice ? `Озвучить (${status.voiceName})` : 'Озвучить (нет немецкого голоса)'}
      className={cn(status.speaking && 'animate-pulse', className)}
    >
      <Volume2 className="size-4" />
    </Button>
  );
}
