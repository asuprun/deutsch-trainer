import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SchemaType, type ResponseSchema } from '@google/generative-ai';
import { getGemini, GEMINI_FALLBACK_MODEL } from '@/lib/gemini/client';

export const runtime = 'nodejs';

// ─── Темы ───────────────────────────────────────────────────────────────────

const TOPICS: Record<string, { role: string; starter: string }> = {
  restaurant: {
    role: 'Du bist ein freundlicher Kellner in einem deutschen Restaurant.',
    starter: 'Guten Tag! Herzlich willkommen! Haben Sie reserviert oder möchten Sie spontan Platz nehmen?',
  },
  shopping: {
    role: 'Du bist ein hilfsbereiter Verkäufer in einem deutschen Kleidungsgeschäft.',
    starter: 'Guten Tag! Kann ich Ihnen helfen? Suchen Sie etwas Bestimmtes?',
  },
  travel: {
    role: 'Du bist ein Mitarbeiter am Informationsschalter eines deutschen Bahnhofs.',
    starter: 'Guten Tag! Wohin möchten Sie reisen? Ich helfe Ihnen gerne!',
  },
  meeting: {
    role: 'Du bist Max, ein junger Berliner, der gerade jemanden Neues kennenlernt.',
    starter: 'Hey! Ich bin Max, ich komme aus Berlin. Und du? Wie heißt du und woher kommst du?',
  },
  free: {
    role: 'Du bist ein offener Gesprächspartner. Sprich über jedes Thema, das der Student vorschlägt.',
    starter: 'Hallo! Schön, dich zu treffen! Worüber möchtest du heute auf Deutsch sprechen?',
  },
};

// ─── System prompt ───────────────────────────────────────────────────────────

function buildSystemPrompt(topicRole: string): string {
  return `
Du bist ein erfahrener Deutschlehrer, der mit einem russischsprachigen Studenten auf Niveau A2-B1 Konversation übt.

ROLLE: ${topicRole}

REGELN:
1. Führe ein natürliches Gespräch auf Deutsch, passend zu Niveau A2-B1 (kurze Sätze, bekannte Wörter).
2. Wenn der Student auf Russisch oder Englisch schreibt, bitte ihn freundlich auf Deutsch zu antworten.
3. Prüfe die letzte Nachricht des Studenten auf Fehler (Grammatik, Kasus, Wortstellung, Artikel).
4. Gib eine russische Übersetzung deiner Antwort.

ANTWORT — nur gültiges JSON, kein anderer Text:
{
  "reply": "deine Antwort auf Deutsch",
  "translation": "перевод твоего ответа на русский",
  "corrections": [
    { "original": "текст студента с ошибкой", "corrected": "исправленный вариант", "explanation": "объяснение на русском" }
  ]
}

corrections: leeres Array [] wenn keine Fehler.
`.trim();
}

// ─── Gemini response schema ───────────────────────────────────────────────────

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    reply:       { type: SchemaType.STRING },
    translation: { type: SchemaType.STRING },
    corrections: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          original:    { type: SchemaType.STRING },
          corrected:   { type: SchemaType.STRING },
          explanation: { type: SchemaType.STRING },
        },
        required: ['original', 'corrected', 'explanation'],
      },
    },
  },
  required: ['reply', 'translation', 'corrections'],
};

// ─── Request validation ───────────────────────────────────────────────────────

const bodySchema = z.object({
  topic: z.enum(['restaurant', 'shopping', 'travel', 'meeting', 'free']).default('free'),
  messages: z
    .array(z.object({ role: z.enum(['user', 'model']), content: z.string().max(2000) }))
    .max(60),
});

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return err('BAD_REQUEST', 'Invalid JSON', 400); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Bad request', 400);

  const { topic, messages } = parsed.data;
  const topicConfig = TOPICS[topic];

  // Стартовое сообщение — без вызова Gemini
  if (messages.length === 0) {
    return NextResponse.json({ reply: topicConfig.starter, translation: '', corrections: [] });
  }

  try {
    // gemini-2.0-flash — стабильнее для JSON-mode в чате (2.5-flash конфликтует с thinking)
    const model = getGemini().getGenerativeModel({
      model: GEMINI_FALLBACK_MODEL,
      systemInstruction: buildSystemPrompt(topicConfig.role),
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.85,
        maxOutputTokens: 2048,
      },
    });

    // История: пропускаем первое сообщение (greeting модели, добавленное без Gemini)
    // и последнее сообщение (текущий запрос пользователя, отправляем через sendMessage)
    // Gemini требует: history должна начинаться с role='user'
    const history = messages.slice(1, -1).map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    const chat   = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    const data   = JSON.parse(result.response.text());

    return NextResponse.json({
      reply:       data.reply       ?? '',
      translation: data.translation ?? '',
      corrections: data.corrections ?? [],
    });
  } catch (e) {
    console.error('[practice/chat]', e);
    return err('GEMINI_ERROR', e instanceof Error ? e.message : 'Gemini error', 500);
  }
}
