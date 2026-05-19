'use client';

import { useRef, useState } from 'react';

type Props = {
  /** Вызывается при свайпе влево (превышение порога) */
  onSwipeLeft?: () => void;
  /** Вызывается при свайпе вправо (превышение порога) */
  onSwipeRight?: () => void;
  /** Текст-штамп при свайпе влево */
  leftLabel?: string;
  /** Текст-штамп при свайпе вправо */
  rightLabel?: string;
  /** Отключает жесты (во время анимации/запроса) */
  disabled?: boolean;
  children: React.ReactNode;
};

/** Минимальное смещение (px) для засчитывания свайпа */
const THRESHOLD = 80;
/** Максимальный наклон карточки (градусы) */
const MAX_ANGLE = 8;

export function SwipeCard({
  onSwipeLeft,
  onSwipeRight,
  leftLabel,
  rightLabel,
  disabled,
  children,
}: Props) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (startX.current === null) return;
    setDx(e.touches[0].clientX - startX.current);
  }

  function handleTouchEnd() {
    if (!disabled) {
      if (dx < -THRESHOLD && onSwipeLeft) onSwipeLeft();
      else if (dx > THRESHOLD && onSwipeRight) onSwipeRight();
    }
    setDx(0);
    startX.current = null;
  }

  const angle = (dx / 300) * MAX_ANGLE;
  // Прогресс к порогу (0-1), начинаем показывать штамп с 20px
  const leftProgress = dx < -20 ? Math.min((Math.abs(dx) - 20) / (THRESHOLD - 20), 1) : 0;
  const rightProgress = dx > 20 ? Math.min((dx - 20) / (THRESHOLD - 20), 1) : 0;

  // Цвета штампов
  const roseAlpha = leftProgress;
  const greenAlpha = rightProgress;

  return (
    <div className="w-full select-none" style={{ touchAction: 'pan-y' }}>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${dx}px) rotate(${angle}deg)`,
          transition: dx === 0 ? 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
        }}
        className="relative w-full"
      >
        {/* ── Штамп «влево» (Again) ── */}
        {leftLabel && leftProgress > 0 && (
          <div
            className="absolute top-4 left-4 z-20 pointer-events-none"
            style={{ opacity: leftProgress }}
            aria-hidden
          >
            <div
              className="rounded-lg px-3 py-1"
              style={{
                border: `3px solid rgba(244, 63, 94, ${roseAlpha})`,
                transform: 'rotate(-12deg)',
              }}
            >
              <span
                className="text-xl font-black tracking-widest uppercase"
                style={{ color: `rgba(244, 63, 94, ${roseAlpha})` }}
              >
                {leftLabel}
              </span>
            </div>
          </div>
        )}

        {/* ── Штамп «вправо» (Easy / Показать) ── */}
        {rightLabel && rightProgress > 0 && (
          <div
            className="absolute top-4 right-4 z-20 pointer-events-none"
            style={{ opacity: rightProgress }}
            aria-hidden
          >
            <div
              className="rounded-lg px-3 py-1"
              style={{
                border: `3px solid rgba(16, 185, 129, ${greenAlpha})`,
                transform: 'rotate(12deg)',
              }}
            >
              <span
                className="text-xl font-black tracking-widest uppercase"
                style={{ color: `rgba(16, 185, 129, ${greenAlpha})` }}
              >
                {rightLabel}
              </span>
            </div>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
