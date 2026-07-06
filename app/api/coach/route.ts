import { NextResponse } from 'next/server';
import type { CoachContext, CoachResponse } from '@/lib/types';

export const runtime = 'nodejs';

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

// ─── Water stripping (pre-LLM) ────────────────────────────────────────────────
// Strip water beverage phrases from user text before the LLM sees them so it
// can never bundle water with food into a single over-estimated calorie entry.
// Falls back to the original string if stripping leaves nothing useful.
//
// "600ml of water and two dates"  → "two dates"
// "a glass of water and two dates" → "two dates"
// "I had water"                   → "I had"  (LLM will ask needsClarification)
// "watermelon"                    → "watermelon" (word boundary protects it)
// "coconut water and a banana"    → "coconut water and a banana" (guarded)

function stripWater(text: string): string {
  // Protect calorie-bearing "coconut water"
  let s = text.replace(/\bcoconut\s+water\b/gi, '\x00CW\x00');

  // Build water-phrase pattern:
  //   optional quantity/vessel prefix + optional modifier + "water"
  const qty    = String.raw`\d+\s*(?:ml|l|liters?|litres?|oz|cups?|glasses?|bottles?)\s+(?:of\s+)?`;
  const vessel = String.raw`a\s+(?:glass|cup|bottle)\s+of\s+`;
  const mod    = String.raw`(?:plain\s+|sparkling\s+|still\s+|mineral\s+)?`;
  const W      = `(?:(?:${qty})|(?:${vessel}))?${mod}water`;

  // Atomic removal — also consume the connecting "and" so nothing is orphaned
  s = s.replace(new RegExp(`${W}\\s*,?\\s*and\\s+`, 'gi'), '');        // "water and X" → keep X
  s = s.replace(new RegExp(`\\s*,?\\s*and\\s+${W}\\b(?!melon)`, 'gi'), ''); // "X and water" → keep X
  s = s.replace(new RegExp(`\\b${W}\\b(?!melon)`, 'gi'), '');           // standalone water

  // Restore
  s = s.replace(/\x00CW\x00/g, 'coconut water');

  s = s.replace(/\s{2,}/g, ' ').trim();
  // Remove dangling connectors left after stripping: "two bananas with" → "two bananas"
  s = s.replace(/\s+(?:with|and|plus|along with|alongside),?\s*$/i, '').trim();
  s = s.replace(/^(?:with|and|plus)\s+/i, '').trim();
  return s || text;
}

// Code-level backstop: remove any entry whose name is still purely water-related.
// Should rarely fire after pre-processing, but belt-and-suspenders.
const ZERO_CAL_ENTRY = /^\s*(?:\d+\s*(?:ml|l|oz|cups?|glasses?)?\s+(?:of\s+)?)?(?:plain\s+|sparkling\s+|still\s+|mineral\s+)?water\s*$/i;

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

  const cleanedText = stripWater(text);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: buildUserTurn(cleanedText, ctx) }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  });

  // Retry once on 503 (transient model overload) after a short delay
  async function fetchGemini(): Promise<Response> {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: requestBody });
    if (r.ok || r.status !== 503) return r;
    await new Promise(res => setTimeout(res, 500));
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: requestBody });
  }

  try {
    const r = await fetchGemini();
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

// ─── System instruction ───────────────────────────────────────────────────────

const SYSTEM = `You are a warm, encouraging fitness coach for an app called Tempo. You log food and exercise the user describes.

Return ONLY valid minified JSON — no markdown, no prose — shaped exactly:
{"needsClarification":boolean,"question":string,"entries":[{"type":"food"|"activity","name":string,"kcal":number,"protein":number,"carbs":number,"fat":number,"durationMin":number_or_null}],"reply":string,"correction":boolean}

RULE 1 — ONE ENTRY PER ITEM. Each distinct food or activity must be its own entry. Never merge multiple foods into one entry.

RULE 2 — QUANTITY REQUIRED FOR FOOD. If any food item lacks an explicit quantity (count, weight, or volume), do not log it. Return needsClarification:true, entries:[], and ask for the missing quantity in "question".

RULE 3 — ACCURATE USDA CALORIES. Use real values: 1 Medjool date = 66 kcal; 1 small dried date = 20 kcal; 1 large egg = 72 kcal; 1 cup cooked white rice = 206 kcal; 1 medium banana = 89 kcal; 100 g chicken breast = 165 kcal; 1 slice bread = 79 kcal.

RULE 4 — USER QUESTIONS. If the user is questioning or disputing a logged entry (e.g. "how is that X calories?", "that seems wrong", "that's too high"), return entries:[] and address their concern in "reply". Do not log anything.

RULE 5 — CORRECTIONS. If the user says they meant a different food or quantity (e.g. "I meant yelakki bananas", "actually it was 3 not 2", "correct that to X"), return the corrected entries with correction:true. The app will remove the previous entries and replace them with yours. All other cases use correction:false.

For activities: estimate kcal BURNED (positive), macros 0, durationMin if estimable.
"reply" = 1–2 warm sentences acknowledging what was logged or answering the question.`;

// ─── User turn ────────────────────────────────────────────────────────────────

function buildUserTurn(text: string, ctx: CoachContext): string {
  return `Goal "${ctx.goalTitle}": ${ctx.target} kcal/day net. Today: eaten ${ctx.eaten} kcal, burned ${ctx.burned} kcal, net ${ctx.net} kcal, protein ${ctx.protein}g / ${ctx.proteinTarget}g.
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
        .filter(e => !ZERO_CAL_ENTRY.test(String(e.name || '')))
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
    correction: !!p.correction,
  };
}
