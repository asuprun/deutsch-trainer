'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, RotateCw, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTTS } from '@/lib/hooks/use-tts';

// ─── Types ────────────────────────────────────────────────────────────────────

type Topic = 'restaurant' | 'shopping' | 'travel' | 'meeting' | 'free';

type Correction = { original: string; corrected: string; explanation: string };

type Message = {
  role: 'user' | 'model';
  content: string;
  translation?: string;
  corrections?: Correction[];
};

// ─── Topic config ─────────────────────────────────────────────────────────────

const TOPICS: Array<{ id: Topic; emoji: string; label: string; desc: string }> = [
  { id: 'restaurant', emoji: '🍽️', label: 'Ресторан',   desc: 'Сделай заказ у официанта' },
  { id: 'shopping',   emoji: '🛍️', label: 'Магазин',    desc: 'Купи что-нибудь в магазине одежды' },
  { id: 'travel',     emoji: '🚂', label: 'Вокзал',     desc: 'Узнай расписание и купи билет' },
  { id: 'meeting',    emoji: '👋', label: 'Знакомство',  desc: 'Познакомься с Максом из Берлина' },
  { id: 'free',       emoji: '💬', label: 'Свободно',   desc: 'Любая тема на твой выбор' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CorrectionBlock({ corrections }: { corrections: Correction[] }) {
  if (!corrections.length) return null;
  return (
    <div className="mt-2 rounded-md bg-amber-500/10 border border-amber-500/25 p-2.5 text-xs space-y-1.5">
      <p className="font-medium text-amber-400">Исправления:</p>
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

function ModelBubble({ msg, isLast }: { msg: Message; isLast: boolean }) {
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

          {/* Перевод */}
          {msg.translation && (
            <div className="mt-2 border-t border-border/50 pt-2">
              {showTranslation ? (
                <p className="text-muted-foreground text-xs">{msg.translation}</p>
              ) : (
                <button
                  onClick={() => setShowTranslation(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  показать перевод
                </button>
              )}
            </div>
          )}
        </div>

        <CorrectionBlock corrections={msg.corrections ?? []} />

        {/* TTS */}
        <button
          onClick={() => speak(msg.content)}
          className="self-start flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
        >
          <Volume2 className="size-3" />
          <span>прослушать</span>
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
  const [topic, setTopic]       = useState<Topic | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Автоскролл вниз
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function startChat(t: Topic) {
    setTopic(t);
    setMessages([]);
    setLoading(true);
    try {
      const res  = await fetch('/api/practice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, messages: [] }),
      });
      const data = await res.json();
      setMessages([{ role: 'model', content: data.reply, translation: data.translation, corrections: [] }]);
    } catch {
      setMessages([{ role: 'model', content: 'Не удалось начать чат. Попробуй ещё раз.', corrections: [] }]);
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
        { role: 'model', content: `⚠️ Ошибка: ${msg}`, corrections: [] },
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

  // ── Экран выбора темы ───────────────────────────────────────────────────────
  if (!topic) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Чат-практика</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Выбери тему — Gemini сыграет роль собеседника и будет исправлять твои ошибки
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              onClick={() => startChat(t.id)}
              className="flex items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted/60 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="text-2xl">{t.emoji}</span>
              <div>
                <p className="font-medium">{t.label}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-lg bg-muted/30 border p-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Как это работает:</p>
          <p>• Gemini ведёт диалог на немецком уровня A2-B1</p>
          <p>• После каждого твоего сообщения — исправление ошибок</p>
          <p>• Перевод ответа скрыт по умолчанию — попробуй угадать сам</p>
          <p>• Кнопка 🔊 озвучит любую фразу голосом de-DE</p>
        </div>
      </div>
    );
  }

  // ── Чат ────────────────────────────────────────────────────────────────────
  const topicConfig = TOPICS.find((t) => t.id === topic)!;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Хедер */}
      <header className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <span className="text-xl">{topicConfig.emoji}</span>
        <div className="flex-1">
          <p className="font-medium text-sm">{topicConfig.label}</p>
          <p className="text-xs text-muted-foreground">Чат-практика · A2-B1</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTopic(null)}
          className="text-muted-foreground"
        >
          <RotateCw className="size-4 mr-1.5" />
          Сменить тему
        </Button>
      </header>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) =>
          msg.role === 'model' ? (
            <ModelBubble key={i} msg={msg} isLast={i === messages.length - 1} />
          ) : (
            <UserBubble key={i} msg={msg} />
          ),
        )}

        {/* Индикатор загрузки */}
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

      {/* Поле ввода */}
      <div className="shrink-0 border-t bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напиши по-немецки… (Enter — отправить, Shift+Enter — новая строка)"
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
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 128) + 'px';
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
          Пиши на немецком — Gemini исправит ошибки и ответит
        </p>
      </div>
    </div>
  );
}
