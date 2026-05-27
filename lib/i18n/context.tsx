'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  type ReactNode,
} from 'react';
import { type Locale, type TranslationKey, translations } from './translations';

type I18nContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextType>({
  locale: 'ru',
  setLocale: () => {},
  t: (key) => translations.ru[key],
});

// useLayoutEffect fires before the browser paints — no flash of wrong language.
// On the server (SSR) we fall back to plain useEffect (it's a no-op there anyway).
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ru');

  useIsomorphicLayoutEffect(() => {
    try {
      const saved = localStorage.getItem('locale') as Locale | null;
      if (saved && (['ru', 'en', 'de'] as const).includes(saved)) {
        setLocaleState(saved);
      }
    } catch {}
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    localStorage.setItem('locale', l);
  }

  const t = (key: TranslationKey): string =>
    (translations[locale][key] ?? translations.ru[key]) as string;

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
