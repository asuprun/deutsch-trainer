'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

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
  tts_voice: 'de-DE',
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
      toast.success('Настройки сохранены');
    } catch (e) {
      toast.error('Не удалось сохранить', {
        description: e instanceof Error ? e.message : '',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="mt-1 text-sm text-muted-foreground">Параметры обучения и интерфейса</p>
      </header>

      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Обучение</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Уровень */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="level">Уровень языка</Label>
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
                <Label htmlFor="daily_goal">Дневная цель (карт)</Label>
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
                <Label htmlFor="request_retention">Удержание FSRS</Label>
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
                  0.9 — по умолчанию. Выше = чаще повторения.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Озвучка (TTS)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* TTS голос */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tts_voice">Голос TTS</Label>
                <Input
                  id="tts_voice"
                  value={form.tts_voice}
                  onChange={handleChange('tts_voice')}
                  placeholder="de-DE, de-AT..."
                  maxLength={50}
                />
              </div>

              {/* Скорость TTS */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tts_rate">Скорость TTS</Label>
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

          {/* Кнопки */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="size-4" />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>

            <Button variant="outline" asChild className="gap-2">
              <a href="/api/export/csv" download="deutsch-trainer-cards.csv">
                <Download className="size-4" />
                Экспорт карт (CSV)
              </a>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
