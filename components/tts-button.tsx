'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTTSContext } from '@/lib/tts-context';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

type Props = {
  text: string;
  rate?: number;
  className?: string;
  size?: 'default' | 'sm' | 'icon';
  autoPlay?: boolean;
};

export function TTSButton({ text, rate = 1, className, size = 'icon', autoPlay = false }: Props) {
  const { t } = useI18n();
  const { speak, status } = useTTSContext();

  if (!status.supported) {
    return (
      <Button variant="ghost" size={size} disabled title={t('tts_unsupported')}>
        <VolumeX className="size-4" />
      </Button>
    );
  }

  if (autoPlay) {
    // Playback must be initiated by a user action,
    // so autoPlay just pre-calls speak once on mount.
    // However in browsers with strict autoplay policy this may not work.
    setTimeout(() => speak(text, rate), 50);
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={() => speak(text, rate)}
      title={status.hasVoice ? `${t('tts_speak')} (${status.voiceName})` : t('tts_no_voice')}
      className={cn(status.speaking && 'animate-pulse', className)}
    >
      <Volume2 className="size-4" />
    </Button>
  );
}
