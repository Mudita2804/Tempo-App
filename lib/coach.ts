'use client';

import type { CoachContext, CoachResponse } from './types';

/**
 * Client helper: send what the user said + current-day context to the server,
 * which calls Gemini and returns the structured CoachResponse.
 * On any failure returns a safe fallback that still honors "ask for quantity".
 */
export async function callCoach(text: string, ctx: CoachContext): Promise<CoachResponse> {
  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ctx }),
    });
    if (!res.ok) throw new Error(`coach ${res.status}`);
    const data = (await res.json()) as CoachResponse;
    if (!data || !Array.isArray(data.entries)) throw new Error('bad shape');
    return { ...data, correction: !!data.correction };
  } catch {
    return localFallback(text);
  }
}

const ACTIVITY_RE = /(walk|run|ran|jog|gym|workout|exercise|cycl|bike|ride|swim|yoga|lift|train|hike)/;
const QTY_RE = /(\d|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bhalf\b|\bquarter\b|cup|gram|\bg\b|\boz\b|slice|bowl|plate|handful|serving|portion|tbsp|tsp|\bml\b|\blarge\b|\bsmall\b|\bmedium\b|scoop|piece)/;

function localFallback(text: string): CoachResponse {
  const low = text.toLowerCase();
  if (ACTIVITY_RE.test(low)) {
    const m = low.match(/(\d+)\s*(min|minute)/);
    const mins = m ? parseInt(m[1], 10) : 30;
    return {
      needsClarification: false,
      entries: [{ type: 'activity', name: text.slice(0, 40), kcal: Math.round(mins * 7), protein: 0, carbs: 0, fat: 0, durationMin: mins }],
      reply: `Logged your activity — about ${Math.round(mins * 7)} kcal burned. Nice work keeping moving.`,
      question: '',
      correction: false,
      correctionTarget: '',
    };
  }
  if (!QTY_RE.test(low)) {
    return {
      needsClarification: true,
      entries: [],
      question: 'Roughly how much did you have? A quick amount — how many, or cups/grams — keeps your calories accurate.',
      reply: '',
      correction: false,
      correctionTarget: '',
    };
  }
  return {
    needsClarification: true,
    entries: [],
    question: "Something went wrong on my end. Could you try again?",
    reply: '',
    correction: false,
    correctionTarget: '',
  };
}
