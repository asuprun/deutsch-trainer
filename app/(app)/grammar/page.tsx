'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, ChevronLeft, Dumbbell, Trash2, Plus, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { GrammarExerciseSession } from '@/components/grammar-exercise-session';
import { GrammarSentenceBuilder } from '@/components/grammar-sentence-builder';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

type GrammarNote = {
  id: string;
  title: string;
  explanation: string;
  examples: { de: string; ru: string }[] | null;
  tags: string[];
  source_id: string | null;
  created_at: string;
};

type Tab = 'rules' | 'exercises';
type ExerciseMode = 'fill' | 'builder';

/** Simple markdown renderer: paragraphs on \n\n, **bold** */
function renderMarkdown(text: string): React.ReactNode[] {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, i) => {
    const parts = para.split(/(\*\*[^*]+\*\*)/g);
    const content = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      const lines = part.split('\n');
      return (
        <span key={j}>
          {lines.map((line, k) => (
            <span key={k}>
              {line}
              {k < lines.length - 1 && <br />}
            </span>
          ))}
        </span>
      );
    });
    return <p key={i} className="not-last:mb-3">{content}</p>;
  });
}

export default function GrammarPage() {
  const { t } = useI18n();
  const [notes, setNotes] = useState<GrammarNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('rules');
  const [activeNote, setActiveNote] = useState<{ id: string; title: string } | null>(null);
  const [exerciseMode, setExerciseMode] = useState<ExerciseMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Добавление правила
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addExplanation, setAddExplanation] = useState('');
  const [addTags, setAddTags] = useState('');
  const [addAi, setAddAi] = useState(true);
  const [saving, setSaving] = useState(false);
  // Обогащение правила
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/grammar');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setNotes(data.grammar_notes ?? []);
      } catch (e) {
        toast.error(t('grammar_load_error'), {
          description: e instanceof Error ? e.message : '',
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [t]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/grammar/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNotes((prev) => prev.filter((n) => n.id !== deleteTarget.id));
      if (activeNote?.id === deleteTarget.id) { setActiveNote(null); setExerciseMode(null); }
      toast.success(t('grammar_deleted'));
      setDeleteTarget(null);
    } catch {
      toast.error(t('grammar_delete_error'));
    } finally {
      setDeleting(false);
    }
  }

  async function createRule() {
    if (!addTitle.trim()) return;
    setSaving(true);
    try {
      const tags = addTags.split(',').map((s) => s.trim()).filter(Boolean);
      const explanation = addExplanation.trim() || addTitle.trim();
      const res = await fetch('/api/grammar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: addTitle.trim(), explanation, tags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      let note: GrammarNote = data.grammar_note;
      // Автодополнение ИИ (если включено)
      if (addAi) {
        const er = await fetch(`/api/grammar/${note.id}/enrich`, { method: 'POST' });
        const ed = await er.json().catch(() => ({}));
        if (er.ok && ed.grammar_note) note = ed.grammar_note;
      }
      setNotes((prev) => [note, ...prev]);
      toast.success(t('grammar_added'));
      setAddOpen(false);
      setAddTitle('');
      setAddExplanation('');
      setAddTags('');
      setAddAi(true);
    } catch (e) {
      toast.error(t('grammar_add_error'), { description: e instanceof Error ? e.message : '' });
    } finally {
      setSaving(false);
    }
  }

  async function enrichNote(id: string) {
    setEnrichingId(id);
    try {
      const res = await fetch(`/api/grammar/${id}/enrich`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      setNotes((prev) => prev.map((n) => (n.id === id ? data.grammar_note : n)));
      toast.success(t('grammar_enriched'));
    } catch (e) {
      toast.error(t('grammar_enrich_error'), { description: e instanceof Error ? e.message : '' });
    } finally {
      setEnrichingId(null);
    }
  }

  const filtered = search
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.explanation.toLowerCase().includes(search.toLowerCase()),
      )
    : notes;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('grammar_title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('grammar_subtitle')}</p>
      </header>

      {/* ── Tab switcher ── */}
      <div className="flex rounded-lg border overflow-hidden w-fit">
        <button
          onClick={() => { setTab('rules'); setActiveNote(null); setExerciseMode(null); }}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm transition-colors',
            tab === 'rules'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <BookOpen className="size-3.5" />
          {t('grammar_tab_rules')}
        </button>
        <button
          onClick={() => { setTab('exercises'); setActiveNote(null); setExerciseMode(null); }}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm transition-colors border-l',
            tab === 'exercises'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <Dumbbell className="size-3.5" />
          {t('grammar_tab_exercises')}
        </button>
      </div>

      {/* ══════════════════════════ TAB: RULES ══════════════════════════════ */}
      {tab === 'rules' && (
        <>
          <div className="flex items-center gap-2">
            <Input
              placeholder={t('grammar_search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button onClick={() => setAddOpen(true)} className="shrink-0 gap-1.5">
              <Plus className="size-4" />
              <span className="hidden sm:inline">{t('grammar_add_btn')}</span>
            </Button>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-lg font-medium">
                {notes.length === 0 ? t('grammar_empty_notes') : t('grammar_empty_search')}
              </p>
              {notes.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('grammar_upload_hint')}
                </p>
              )}
            </div>
          ) : (
            <Accordion type="multiple" className="rounded-lg border divide-y">
              {filtered.map((note) => (
                <AccordionItem key={note.id} value={note.id} className="border-0 px-4">
                  <AccordionTrigger className="text-base font-medium py-3.5">
                    {note.title}
                    {note.tags.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {note.tags.join(', ')}
                      </span>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="text-sm text-foreground/90 leading-relaxed">
                      {renderMarkdown(note.explanation)}
                    </div>

                    {note.examples && note.examples.length > 0 && (
                      <div className="mt-4 flex flex-col gap-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {t('grammar_examples_label')}
                        </p>
                        {note.examples.map((ex, i) => (
                          <div key={i} className="text-sm">
                            <span className="font-medium">{ex.de}</span>
                            <span className="text-muted-foreground"> · {ex.ru}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quick-launch exercises + enrich + delete */}
                    <div className="mt-4 pt-3 border-t flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveNote({ id: note.id, title: note.title });
                            setExerciseMode(null);
                            setTab('exercises');
                          }}
                        >
                          <Dumbbell className="size-3.5 mr-1.5" />
                          {t('grammar_practice_btn')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={enrichingId === note.id}
                          onClick={() => enrichNote(note.id)}
                        >
                          {enrichingId === note.id ? (
                            <><Loader2 className="size-3.5 mr-1.5 animate-spin" />{t('grammar_enriching')}</>
                          ) : (
                            <><Sparkles className="size-3.5 mr-1.5" />{t('grammar_enrich_btn')}</>
                          )}
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget({ id: note.id, title: note.title })}
                      >
                        <Trash2 className="size-3.5 mr-1.5" />
                        {t('btn_delete')}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </>
      )}

      {/* ════════════════════════ TAB: EXERCISES ════════════════════════════ */}
      {tab === 'exercises' && (
        <>
          {/* Fill-in-the-blank session */}
          {activeNote && exerciseMode === 'fill' && (
            <GrammarExerciseSession
              noteId={activeNote.id}
              noteTitle={activeNote.title}
              onBack={() => { setExerciseMode(null); }}
            />
          )}

          {/* Sentence builder session */}
          {activeNote && exerciseMode === 'builder' && (
            <GrammarSentenceBuilder
              noteId={activeNote.id}
              noteTitle={activeNote.title}
              onBack={() => { setExerciseMode(null); }}
            />
          )}

          {/* Mode picker — shown when topic selected but no mode yet */}
          {activeNote && exerciseMode === null && (
            <div className="flex flex-col gap-5 max-w-sm">
              <div>
                <p className="text-sm text-muted-foreground">{t('grammar_topic_label')}</p>
                <p className="font-medium mt-0.5">{activeNote.title}</p>
              </div>
              <p className="text-sm font-medium">{t('grammar_choose_mode')}</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setExerciseMode('fill')}
                  className="flex-1 flex flex-col items-center gap-2 rounded-xl border px-5 py-4 text-sm font-medium hover:bg-muted/60 transition-colors"
                >
                  <span className="text-2xl">📝</span>
                  {t('grammar_mode_fill')}
                </button>
                <button
                  onClick={() => setExerciseMode('builder')}
                  className="flex-1 flex flex-col items-center gap-2 rounded-xl border px-5 py-4 text-sm font-medium hover:bg-muted/60 transition-colors"
                >
                  <span className="text-2xl">🔀</span>
                  {t('grammar_mode_builder')}
                </button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => { setActiveNote(null); setExerciseMode(null); }}
              >
                <ChevronLeft className="size-4 mr-1" />
                {t('grammar_back_to_topics')}
              </Button>
            </div>
          )}

          {/* Topic picker — shown when no active note */}
          {!activeNote && (
            <div className="flex flex-col gap-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))
              ) : notes.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-lg font-medium">{t('grammar_no_topics')}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('grammar_no_topics_hint')}
                  </p>
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{note.title}</p>
                      {note.tags.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {note.tags.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveNote({ id: note.id, title: note.title });
                          setExerciseMode(null);
                        }}
                      >
                        <Dumbbell className="size-3.5 mr-1.5" />
                        {t('grammar_train_btn')}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget({ id: note.id, title: note.title })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
      {/* ── Confirm delete dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('grammar_delete_title')}</DialogTitle>
            <DialogDescription>
              {deleteTarget?.title && (
                <span className="block font-medium text-foreground mb-1">{deleteTarget.title}</span>
              )}
              {t('grammar_delete_confirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t('btn_cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? t('btn_loading') : t('btn_delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add rule dialog ── */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!saving) setAddOpen(open); }}>
        <DialogContent showCloseButton={!saving}>
          <DialogHeader>
            <DialogTitle>{t('grammar_add_dialog_title')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('grammar_add_title_label')}</label>
              <Input
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder={t('grammar_add_title_ph')}
                disabled={saving}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('grammar_add_expl_label')}</label>
              <textarea
                value={addExplanation}
                onChange={(e) => setAddExplanation(e.target.value)}
                placeholder={t('grammar_add_expl_ph')}
                disabled={saving}
                rows={4}
                className="resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('grammar_add_tags_label')}</label>
              <Input
                value={addTags}
                onChange={(e) => setAddTags(e.target.value)}
                placeholder={t('grammar_add_tags_ph')}
                disabled={saving}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={addAi}
                onChange={(e) => setAddAi(e.target.checked)}
                disabled={saving}
                className="size-4 accent-primary"
              />
              <Sparkles className="size-3.5 text-primary" />
              {t('grammar_add_ai')}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              {t('btn_cancel')}
            </Button>
            <Button onClick={createRule} disabled={saving || !addTitle.trim()}>
              {saving ? (
                <><Loader2 className="size-4 mr-1.5 animate-spin" />{t('btn_saving')}</>
              ) : (
                t('btn_save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
