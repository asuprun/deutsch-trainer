'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, RotateCw, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTTS } from '@/lib/hooks/use-tts';
import { useI18n } from '@/lib/i18n/context';

// ─── Types ────────────────────────────────────────────────────────────────────

type Topic = 'restaurant' | 'shopping' | 'travel' | 'meeting' | 'free';

type Correction = { original: string; corrected: string; explanation: string };

type Message = {
  role: 'user' | 'model';
  content: string;
  translation?: string;
  corrections?: Correction[];
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CorrectionBlock({ corrections, label }: { corrections: Correction[]; label: string }) {
  if (!corrections.length) return null;
  return (
    <div className="mt-2 rounded-md bg-amber-500/10 border border-amber-500/25 p-2.5 text-xs space-y-1.5">
      <p className="font-medium text-amber-400">{label}</p>
      {corrections.map((c, i) => (
        <div key={i}>
          <span className="line-through text-muted-foreground">{c.original}</span>
          {' → '}
          <span className="text-emerald-400 font-medium">{c.corrected}</span>
          <p className="text-muted-foreground mt-0.5">{c.explanation}</p>
        </div>
      ))}
    </div>
  );
}

function ModelBubble({ msg, isLast, showTranslationLabel, listenLabel, correctionsLabel }: {
  msg: Message;
  isLast: boolean;
  showTranslationLabel: string;
  listenLabel: string;
  correctionsLabel: string;
}) {
  const { speak } = useTTS();
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <div className="flex items-start gap-2 max-w-[85%]">
      <div className="shrink-0 size-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold text-white">
        DE
      </div>
      <div className="flex flex-col gap-1">
        <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm">
          <p className="leading-relaxed">{msg.content}</p>

          {/* Translation */}
          {msg.translation && (
            <div className="mt-2 border-t border-border/50 pt-2">
              {showTranslation ? (
                <p className="text-muted-foreground text-xs">{msg.translation}</p>
              ) : (
                <button
                  onClick={() => setShowTranslation(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  {showTranslationLabel}
                </button>
              )}
            </div>
          )}
        </div>

        <CorrectionBlock corrections={msg.corrections ?? []} label={correctionsLabel} />

        {/* TTS */}
        <button
          onClick={() => speak(msg.content)}
          className="self-start flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
        >
          <Volume2 className="size-3" />
          <span>{listenLabel}</span>
        </button>
      </div>
    </div>
  );
}

function UserBubble({ msg }: { msg: Message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed">
        {msg.content}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PracticePage() {
  const { t } = useI18n();

  const TOPICS: Array<{ id: Topic; emoji: string; label: string; desc: string }> = [
    { id: 'restaurant', emoji: '🍽️', label: t('practice_topic_restaurant_label'), desc: t('practice_topic_restaurant_desc') },
    { id: 'shopping',   emoji: '🛍️', label: t('practice_topic_shopping_label'),   desc: t('practice_topic_shopping_desc') },
    { id: 'travel',     emoji: '🚂', label: t('practice_topic_travel_label'),     desc: t('practice_topic_travel_desc') },
    { id: 'meeting',    emoji: '👋', label: t('practice_topic_meeting_label'),    desc: t('practice_topic_meeting_desc') },
    { id: 'free',       emoji: '💬', label: t('practice_topic_free_label'),       desc: t('practice_topic_free_desc') },
  ];

  const [topic, setTopic]       = useState<Topic | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll down
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function startChat(tp: Topic) {
    setTopic(tp);
    setMessages([]);
    setLoading(true);
    try {
      const res  = await fetch('/api/practice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: tp, messages: [] }),
      });
      const data = await res.json();
      setMessages([{ role: 'model', content: data.reply, translation: data.translation, corrections: [] }]);
    } catch {
      setMessages([{ role: 'model', content: t('practice_start_error'), corrections: [] }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading || !topic) return;
    const userText = input.trim();
    setInput('');

    const userMsg: Message = { role: 'user', content: userText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/practice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message);
      setMessages((prev) => [
        ...prev,
        { role: 'model', content: data.reply, translation: data.translation, corrections: data.corrections },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [
        ...prev,
        { role: 'model', content: `⚠️ ${msg}`, corrections: [] },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── Topic selection screen ──────────────────────────────────────────────────
  if (!topic) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{t('practice_title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('practice_subtitle')}
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {TOPICS.map((tp) => (
            <button
              key={tp.id}
              onClick={() => startChat(tp.id)}
              className="flex items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted/60 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="text-2xl">{tp.emoji}</span>
              <div>
                <p className="font-medium">{tp.label}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{tp.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-lg bg-muted/30 border p-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">{t('practice_how_title')}</p>
          <p>{t('practice_how_1')}</p>
          <p>{t('practice_how_2')}</p>
          <p>{t('practice_how_3')}</p>
          <p>{t('practice_how_4')}</p>
        </div>
      </div>
    );
  }

  // ── Chat ─────────────────────────────────────────────────────────────────────
  const topicConfig = TOPICS.find((tp) => tp.id === topic)!;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <span className="text-xl">{topicConfig.emoji}</span>
        <div className="flex-1">
          <p className="font-medium text-sm">{topicConfig.label}</p>
          <p className="text-xs text-muted-foreground">{t('practice_chat_label')}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTopic(null)}
          className="text-muted-foreground"
        >
          <RotateCw className="size-4 mr-1.5" />
          {t('practice_change_topic')}
        </Button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) =>
          msg.role === 'model' ? (
            <ModelBubble
              key={i}
              msg={msg}
              isLast={i === messages.length - 1}
              showTranslationLabel={t('practice_show_translation')}
              listenLabel={t('practice_listen')}
              correctionsLabel={t('practice_corrections')}
            />
          ) : (
            <UserBubble key={i} msg={msg} />
          ),
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-start gap-2">
            <div className="shrink-0 size-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold text-white">
              DE
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('practice_placeholder')}
            rows={1}
            disabled={loading}
            className={cn(
              'flex-1 resize-none rounded-xl border bg-muted/30 px-3 py-2.5 text-sm',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary',
              'min-h-[44px] max-h-32 overflow-y-auto transition-colors',
              'disabled:opacity-50',
            )}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const tgt = e.currentTarget;
              tgt.style.height = 'auto';
              tgt.style.height = Math.min(tgt.scrollHeight, 128) + 'px';
            }}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="shrink-0 size-11 rounded-xl"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-1.5 hidden sm:block">
          {t('practice_footer_hint')}
        </p>
      </div>
    </div>
  );
}
