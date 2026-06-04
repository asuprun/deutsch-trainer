'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSavedTTS } from '@/lib/hooks/use-saved-tts';
import { Download, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { TtsVoicePicker } from '@/components/tts-voice-picker';
import { LocaleToggle } from '@/components/locale-toggle';
import { PushToggle } from '@/components/push-toggle';
import { GeminiUsage } from '@/components/gemini-usage';
import { useI18n } from '@/lib/i18n/context';

type SettingsData = {
  level: string;
  daily_goal: number;
  fsrs_params: Record<string, unknown> | null;
  tts_voice: string;
  tts_rate: number;
};

type FormState = {
  level: string;
  daily_goal: string;
  tts_voice: string;
  tts_rate: string;
  request_retention: string;
};

const DEFAULTS: FormState = {
  level: 'A2-B1',
  daily_goal: '20',
  tts_voice: '',
  tts_rate: '1.0',
  request_retention: '0.9',
};

function settingsToForm(s: SettingsData): FormState {
  return {
    level: s.level ?? '',
    daily_goal: String(s.daily_goal ?? 20),
    tts_voice: s.tts_voice ?? 'de-DE',
    tts_rate: String(s.tts_rate ?? 1.0),
    request_retention: String(
      (s.fsrs_params as { request_retention?: number } | null)?.request_retention ?? 0.9,
    ),
  };
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { setVoiceName } = useSavedTTS();
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d: SettingsData) => setForm(settingsToForm(d)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        level: form.level,
        daily_goal: parseInt(form.daily_goal, 10),
        tts_voice: form.tts_voice,
        tts_rate: parseFloat(form.tts_rate),
        request_retention: parseFloat(form.request_retention),
      };

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }

      const updated: SettingsData = await res.json();
      setForm(settingsToForm(updated));
      // Синхронизируем голос в localStorage — useSavedTTS читает его первым
      if (updated.tts_voice) setVoiceName(updated.tts_voice);
      toast.success(t('settings_saved'));
    } catch (e) {
      toast.error(t('settings_save_error'), {
        description: e instanceof Error ? e.message : '',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('settings_title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings_subtitle')}</p>
      </header>

      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Язык интерфейса */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('settings_language')}</CardTitle>
            </CardHeader>
            <CardContent>
              <LocaleToggle />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('settings_learning')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Уровень */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="level">{t('settings_level')}</Label>
                <Input
                  id="level"
                  value={form.level}
                  onChange={handleChange('level')}
                  placeholder="A1, A2, B1, B2..."
                  maxLength={10}
                />
              </div>

              {/* Дневная цель */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="daily_goal">{t('settings_daily_goal')}</Label>
                <Input
                  id="daily_goal"
                  type="number"
                  min={1}
                  max={500}
                  value={form.daily_goal}
                  onChange={handleChange('daily_goal')}
                />
              </div>

              {/* Удержание FSRS */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="request_retention">{t('settings_retention')}</Label>
                <Input
                  id="request_retention"
                  type="number"
                  step={0.01}
                  min={0.7}
                  max={0.99}
                  value={form.request_retention}
                  onChange={handleChange('request_retention')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings_retention_hint')}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('settings_tts')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* TTS голос */}
              <div className="flex flex-col gap-1.5">
                <Label>{t('settings_tts_voice')}</Label>
                <TtsVoicePicker
                  value={form.tts_voice}
                  onChange={(name) => setForm((prev) => ({ ...prev, tts_voice: name }))}
                  lang="de-DE"
                />
              </div>

              {/* Скорость TTS */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tts_rate">{t('settings_tts_rate')}</Label>
                <Input
                  id="tts_rate"
                  type="number"
                  step={0.1}
                  min={0.5}
                  max={2.0}
                  value={form.tts_rate}
                  onChange={handleChange('tts_rate')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Уведомления */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('settings_notifications')}</CardTitle>
            </CardHeader>
            <CardContent>
              <PushToggle />
            </CardContent>
          </Card>

          {/* Использование Gemini API */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('settings_ai_usage')}</CardTitle>
            </CardHeader>
            <CardContent>
              <GeminiUsage />
            </CardContent>
          </Card>

          {/* Кнопки */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="size-4" />
              {saving ? t('btn_saving') : t('btn_save')}
            </Button>

            <Button variant="outline" asChild className="gap-2">
              <a href="/api/export/csv" download="deutsch-trainer-cards.csv">
                <Download className="size-4" />
                {t('settings_export_csv')}
              </a>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
