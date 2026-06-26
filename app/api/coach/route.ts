import { NextResponse } from 'next/server';
import type { CoachContext, CoachResponse } from '@/lib/types';

export const runtime = 'nodejs';

// Google Gemini (free tier). Get a key at https://aistudio.google.com/apikey
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

/**
 * POST /api/coach
 * body: { text: string, ctx: CoachContext }
 * → CoachResponse (strict JSON contract, see ../README.md → LLM contract)
 *
 * Precision rule: food without an explicit quantity must NOT be logged — the
 * model returns needsClarification:true with a question instead.
 */
export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });
  }

  let text: string;
  let ctx: CoachContext;
  try {
    const body = await req.json();
    text = String(body.text || '').trim();
    ctx = body.ctx;
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: 'empty text' }, { status: 400 });

  const prompt = buildPrompt(text, ctx);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        // Ask Gemini to return raw JSON so parsing is reliable.
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return NextResponse.json({ error: 'llm error', detail }, { status: 502 });
    }
    const data = await r.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = parseJson(raw);
    return NextResponse.json(normalize(parsed));
  } catch (e) {
    return NextResponse.json({ error: 'llm exception', detail: String(e) }, { status: 502 });
  }
}

function buildPrompt(text: string, ctx: CoachContext): string {
  return `You log food and exercise a user describes, for a fitness app called Tempo, replying as a warm, encouraging coach.
Return ONLY valid minified JSON (no markdown, no prose) shaped exactly:
{"needsClarification":boolean,"question":string,"entries":[{"type":"food"|"activity","name":string,"kcal":number,"protein":number,"carbs":number,"fat":number,"durationMin":number_or_null}],"reply":string}

ACCURACY RULE — quantity is REQUIRED for food. If ANY food item is mentioned without an explicit amount (e.g. "a sandwich", "pasta", "some rice", "a coffee" with no size/count/weight/volume), do NOT estimate or log it. Instead set "needsClarification":true, leave "entries":[], and put ONE concise question in "question" asking for the specific quantity of every under-specified item. NEVER assume or default a portion — precision is the priority. Only once every amount is explicit should you log, computing kcal and macros precisely for those exact quantities.
Activities do NOT require the user to state calories or always a duration; estimate kcal burned from the activity and any stated/typical duration.

When logging (needsClarification:false): food kcal = calories consumed with realistic macro grams for the stated amount; activity kcal = calories BURNED (positive), macros 0, durationMin if stated/estimable. Multiple items → multiple entries. "reply" = 1-2 warm sentences referencing their day and a next step.

Context — goal "${ctx.goalTitle}": net ${ctx.target} kcal/day. Today so far: eaten ${ctx.eaten}, burned ${ctx.burned}, net ${ctx.net} kcal; protein ${ctx.protein}g of ${ctx.proteinTarget}g.
Recent conversation (use it to resolve a quantity the user is now answering):
${ctx.history}
Newest user message: "${text}"`;
}

function parseJson(raw: string): Partial<CoachResponse> {
  let s = raw.trim().replace(/```json/gi, '').replace(/```/g, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0 && b >= 0) s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch { return {}; }
}

function normalize(p: Partial<CoachResponse>): CoachResponse {
  const entries = Array.isArray(p.entries) ? p.entries.map((e) => ({
    type: (e.type === 'activity' ? 'activity' : 'food') as import('@/lib/types').EntryType,
    name: String(e.name || 'Entry'),
    kcal: Math.max(0, Math.round(Number(e.kcal) || 0)),
    protein: Math.round(Number(e.protein) || 0),
    carbs: Math.round(Number(e.carbs) || 0),
    fat: Math.round(Number(e.fat) || 0),
    durationMin: e.durationMin == null ? null : Math.round(Number(e.durationMin)),
  })) : [];
  return {
    needsClarification: !!p.needsClarification,
    question: String(p.question || ''),
    entries,
    reply: String(p.reply || (entries.length ? 'Logged it for you.' : '')),
  };
}
