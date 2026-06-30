import { NextResponse } from 'next/server';
import type { CoachContext, CoachResponse } from '@/lib/types';

export const runtime = 'nodejs';

const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// Names that are purely zero-calorie drinks — strip them regardless of what the model returns.
const ZERO_CAL_ENTRY = /^\s*(plain\s+)?(still\s+|sparkling\s+|mineral\s+)?water(\s+\d+\s*(ml|l|oz|cups?)?)?\s*$/i;

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: buildUserTurn(text, ctx) }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
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

// ─── System instruction (higher model priority than user turn) ────────────────

const SYSTEM = `You are a warm, encouraging fitness coach for an app called Tempo. You log food and exercise the user describes.

Return ONLY valid minified JSON — no markdown, no prose — shaped exactly:
{"needsClarification":boolean,"question":string,"entries":[{"type":"food"|"activity","name":string,"kcal":number,"protein":number,"carbs":number,"fat":number,"durationMin":number_or_null}],"reply":string}

RULE 1 — WATER HAS ZERO CALORIES. Plain water, sparkling water, mineral water = 0 kcal. Never create an entry for water. Never add water's "calories" to another entry. If the user mentions water alongside food, silently skip the water and only log the food items. This rule is absolute and overrides all other reasoning.

RULE 2 — ONE ENTRY PER FOOD ITEM. Each distinct food or activity must be its own entry. Never merge multiple foods into a single entry.

RULE 3 — QUANTITY REQUIRED FOR FOOD. If any food item lacks an explicit quantity (count, weight, or volume), do not log it. Instead return needsClarification:true, entries:[], and ask for the missing quantity in "question".

RULE 4 — ACCURATE USDA CALORIES. Use real values: 1 Medjool date = 66 kcal; 1 small dried date = 20 kcal; 1 large egg = 72 kcal; 1 cup cooked white rice = 206 kcal; 1 medium banana = 89 kcal; 100 g chicken breast = 165 kcal; 1 slice bread = 79 kcal.

RULE 5 — USER QUESTIONS OR CORRECTIONS. If the user is questioning or disputing a logged entry (e.g. "how is that X calories?", "that seems wrong", "that's too high", "why did you log that?"), return entries:[] and address their concern in "reply". Do not log anything.

For activities: estimate kcal BURNED (positive number), macros 0, durationMin if estimable.
"reply" = 1–2 warm sentences acknowledging what was logged or answering the question.`;

// ─── User turn: context + message ─────────────────────────────────────────────

function buildUserTurn(text: string, ctx: CoachContext): string {
  return `Goal "${ctx.goalTitle}": ${ctx.target} kcal/day net. Today so far: eaten ${ctx.eaten} kcal, burned ${ctx.burned} kcal, net ${ctx.net} kcal, protein ${ctx.protein}g / ${ctx.proteinTarget}g.
Recent conversation:
${ctx.history}
User: "${text}"`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJson(raw: string): Partial<CoachResponse> {
  let s = raw.trim().replace(/```json/gi, '').replace(/```/g, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0 && b >= 0) s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch { return {}; }
}

function normalize(p: Partial<CoachResponse>): CoachResponse {
  const entries = Array.isArray(p.entries)
    ? p.entries
        .filter(e => !ZERO_CAL_ENTRY.test(String(e.name || '')))  // strip water entries the model snuck in
        .map(e => ({
          type: (e.type === 'activity' ? 'activity' : 'food') as import('@/lib/types').EntryType,
          name: String(e.name || 'Entry'),
          kcal: Math.max(0, Math.round(Number(e.kcal) || 0)),
          protein: Math.round(Number(e.protein) || 0),
          carbs: Math.round(Number(e.carbs) || 0),
          fat: Math.round(Number(e.fat) || 0),
          durationMin: e.durationMin == null ? null : Math.round(Number(e.durationMin)),
        }))
    : [];
  return {
    needsClarification: !!p.needsClarification,
    question: String(p.question || ''),
    entries,
    reply: String(p.reply || (entries.length ? 'Logged it for you.' : '')),
  };
}
