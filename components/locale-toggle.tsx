'use client';

import { useI18n } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';

const LOCALES: { value: Locale; label: string }[] = [
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
  { value: 'de', label: 'DE' },
];

export function LocaleToggle() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex rounded-md border overflow-hidden w-fit">
      {LOCALES.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setLocale(value)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium transition-colors',
            value !== 'ru' && 'border-l',
            locale === value
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
