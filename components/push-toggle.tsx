'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';

type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

/** Конвертирует base64url → ArrayBuffer (нужно для VAPID applicationServerKey) */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export function PushToggle() {
  const { t } = useI18n();
  const [state, setState] = useState<PushState>('loading');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'subscribed' : 'unsubscribed');
    });
  }, []);

  async function subscribe() {
    setState('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState('subscribed');
      toast.success(t('push_enable'), {
        description: t('push_hint'),
      });
    } catch (e) {
      setState('unsubscribed');
      toast.error('Не удалось подписаться', {
        description: e instanceof Error ? e.message : '',
      });
    }
  }

  async function unsubscribe() {
    setState('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: 'DELETE',
        });
      }
      setState('unsubscribed');
      toast.success(t('push_disable'));
    } catch (e) {
      setState('subscribed');
      toast.error('Ошибка отписки', {
        description: e instanceof Error ? e.message : '',
      });
    }
  }

  if (state === 'unsupported') {
    return <p className="text-sm text-muted-foreground">{t('push_unsupported')}</p>;
  }

  if (state === 'denied') {
    return <p className="text-sm text-muted-foreground">{t('push_denied')}</p>;
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>{t('btn_loading')}</span>
      </div>
    );
  }

  if (state === 'subscribed') {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <Bell className="size-4" />
          <span>{t('push_enabled')}</span>
        </div>
        <Button size="sm" variant="outline" onClick={unsubscribe}>
          <BellOff className="size-3.5 mr-1.5" />
          {t('push_disable')}
        </Button>
      </div>
    );
  }

  // unsubscribed
  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" onClick={subscribe} className="w-fit">
        <Bell className="size-3.5 mr-1.5" />
        {t('push_enable')}
      </Button>
      <p className="text-xs text-muted-foreground">{t('push_hint')}</p>
    </div>
  );
}
