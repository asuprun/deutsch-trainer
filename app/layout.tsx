import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { PwaInit } from '@/components/pwa-init';
import { I18nProvider } from '@/lib/i18n/context';
import './globals.css';

const fontSans = Inter({
  variable: '--font-sans',
  subsets: ['latin', 'cyrillic'],
});

const fontMono = JetBrains_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Deutsch Trainer',
  description: 'Личное приложение для изучения немецкого',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Deutsch Trainer' },
};

export const viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <I18nProvider>
            {children}
            <Toaster richColors position="top-right" />
            <PwaInit />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
