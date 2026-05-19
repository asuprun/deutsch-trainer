'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
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

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ru');

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale | null;
    if (saved && ['ru', 'en', 'de'].includes(saved)) setLocaleState(saved);
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
