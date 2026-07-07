# Tempo — AI Coach Reference

Bootstrap context for new sessions. Read this before touching any coach-related code.

---

## What the coach does

The coach is a conversational food/activity logger. The user types or speaks what they ate or did. The coach parses natural language, asks clarifying questions when quantity or specificity is unclear, and returns structured entries that land in the Zustand store.

It does **not** track water (stripped pre-LLM). It does not log the coach's own questions as food entries.

---

## Request flow

```
User input (text or voice)
  ↓ CoachRail.tsx: submit()
  ↓ lib/coach.ts: callCoach(text, ctx)  — client helper
  ↓ POST /api/coach                     — Next.js route
      ↓ stripWater(text)                — pre-LLM preprocessing
      ↓ buildUserTurn(cleanedText, ctx) — inject context
      ↓ Gemini API (gemini-flash-lite-latest)
      ↓ parseJson() → normalize()
  ↓ CoachResponse returned to CoachRail
  ↓ correction? → removeEntry(lastAddedIds) before addEntries()
  ↓ entries appended to store → Supabase fire-and-forget sync
```

---

## File map

| File | Role |
|---|---|
| `app/api/coach/route.ts` | Server: stripWater, Gemini call, system prompt, normalize |
| `lib/coach.ts` | Client: callCoach wrapper, localFallback |
| `lib/types.ts` | CoachEntry, CoachResponse, CoachContext interfaces |
| `app/components/CoachRail.tsx` | UI: input, message thread, correction mechanism |
| `lib/store.ts` | addEntries, removeEntry, pushMessage |
| `.env.local` | GEMINI_API_KEY, GEMINI_MODEL |

---

## JSON contract

Every Gemini response is parsed into this shape (defined in `lib/types.ts:CoachResponse`):

```typescript
{
  needsClarification: boolean,   // true → show question, no entries
  question: string,              // shown to user when needsClarification
  entries: CoachEntry[],         // zero or more items to log
  reply: string,                 // warm acknowledgement or question answer
  correction: boolean,           // true → remove lastAddedIds before logging
}

CoachEntry {
  type: 'food' | 'activity',
  name: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  durationMin: number | null,
}
```

`normalize()` in route.ts enforces this shape on whatever Gemini returns — coerces types, clamps negatives, strips pure-water entries.

---

## CoachContext — what goes to Gemini per request

Built in `CoachRail.tsx:submit()`, sent as `ctx` in the POST body:

```typescript
{
  goalTitle:     string,   // e.g. "Weight loss"
  target:        number,   // daily net kcal target
  goalType:      GoalType, // 'lose' | 'maintain' | 'gain'
  eaten:         number,   // kcal consumed today so far
  burned:        number,   // kcal burned today so far
  net:           number,   // eaten - burned
  protein:       number,   // grams consumed today
  proteinTarget: number,   // grams target
  history:       string,   // last 6 messages, format "User: … / Coach: …"
}
```

`history` is the last 6 store messages joined with newlines — gives the LLM enough context for corrections ("I meant yelakki") without blowing the prompt.

---

## Pre-processing: stripWater()

`stripWater()` in `app/api/coach/route.ts` strips plain water phrases **before** the text reaches Gemini. Purpose: prevent the LLM from ever bundling water kcal into a food entry or logging water as a food item.

### What it handles

| Input | Output |
|---|---|
| `"600ml of water and two dates"` | `"two dates"` |
| `"a glass of water and two dates"` | `"two dates"` |
| `"I had two bananas with 600ml water"` | `"I had two bananas"` |
| `"watermelon"` | `"watermelon"` (word boundary protects it) |
| `"coconut water and a banana"` | `"coconut water and a banana"` (guarded) |
| `"I had water"` | `"I had"` (LLM asks needsClarification) |

### How it works

1. **Protect coconut water** — temporarily replace with a sentinel (`\x00CW\x00`) before stripping.
2. **Strip water phrases** — pattern covers optional quantity/vessel prefix + optional modifier (`plain`, `sparkling`, etc.) + `"water"`. Three passes:
   - `"water and X"` → keep X (atomic "and" removal)
   - `"X and water"` → keep X
   - standalone `"water"` (word boundary, not `"watermelon"`)
3. **Restore coconut water** from sentinel.
4. **Clean dangling connectors** — post-strip, remove trailing `"with"`, `"and"`, `"plus"` etc. that would confuse the LLM into asking "with what?".
5. **Fallback** — if stripping produces an empty string, return the original text unchanged.

### Belt-and-suspenders filter

`ZERO_CAL_ENTRY` regex in `normalize()` removes any entry whose `name` is still purely water-related, even if stripWater missed it.

---

## System prompt — all 5 rules

Current system prompt in `app/api/coach/route.ts:SYSTEM`. Temperature: 0.2.

### RULE 1 — ONE ENTRY PER ITEM
Each distinct food or activity must be its own entry. Never merge multiple foods into one.

**Why:** LLM tendency to group "two bananas and an egg" into a single averaged entry.

---

### RULE 2 — CLARIFY BEFORE LOGGING
Before logging any food, confirm:

**a) QUANTITY** — A usable amount must be present.
- Exact → log directly.
- Vague term ("some", "a bowl") → offer 2–3 practical reference sizes.
- User unsure → accept best guess. Never block indefinitely over precision.

**b) SPECIFICITY** — If the food name is too generic (variety/type/size/prep would meaningfully change kcal), ask which it is. Apply to **any food** — not food-specific rules.

Ask ONE question covering all missing info together.

**Why:** Without this, the LLM logged unspecified "bananas" using standard banana calories when yelakki/elaichi bananas are ~33% fewer kcal. Also blocked logging when users said "I'm not sure exactly" — rule now explicitly says accept best guesses.

**Important:** RULE 5 overrides RULE 2 for corrections (see below).

---

### RULE 3 — ACCURATE USDA CALORIES
USDA anchors baked into the prompt:
- 1 Medjool date = 66 kcal
- 1 small dried date = 20 kcal
- 1 large egg = 72 kcal
- 1 cup cooked white rice = 206 kcal
- 1 medium banana = 89 kcal
- 1 yelakki/elaichi/small Indian banana = 60 kcal
- 100 g chicken breast = 165 kcal
- 1 slice bread = 79 kcal

**Why:** LLM was computing per-banana kcal correctly (60) but then applying that total to each of two entries instead of splitting. Explicit anchors stabilize output.

---

### RULE 4 — USER QUESTIONS
If the user is questioning/disputing a logged entry ("how is that X calories?", "that seems wrong"), return `entries: []` and address the concern in `reply`. Do not log anything.

**Why:** Without this, the LLM logged the user's question as a food entry (e.g. "how many calories is that?" → logged as 0 kcal food).

---

### RULE 5 — CORRECTIONS
If the user is clarifying/correcting a previously logged food (e.g. "I meant yelakki", "actually it was 3 not 2"), return corrected entries with `correction: true`.

**IMPORTANT:** If the user corrects type/name without restating quantity, infer the quantity from the most recent logged item in conversation history. Do NOT ask for quantity again — this overrides RULE 2 for corrections.

**Why:** Two bugs prompted this rule:
1. "I meant yelakki bananas" appended new entries instead of replacing → needed `correction: true` flag.
2. After saying "correction: true", LLM still asked "how many?" because RULE 2 fired — needed explicit RULE 5 override.

---

## Model

**Current:** `gemini-flash-lite-latest`  
**Set via:** `GEMINI_MODEL` env var (`.env.local` + Vercel environment variables)  
**Default fallback:** `gemini-flash-lite-latest` (same, hardcoded in `route.ts:MODEL`)

### Model history and why each was abandoned

| Model | Status | Reason abandoned |
|---|---|---|
| `gemini-1.5-flash` | Dead | Removed from v1beta API entirely (404) |
| `gemini-2.5-flash-lite` | Unusable on free tier | Persistent 503s — high demand, overloaded |
| `gemini-2.0-flash` | Requires billing | 429 on free tier |
| `gemini-flash-lite-latest` | **Current, working** | Stable free-tier alias, 5/5 requests successful |

### Retry logic
`fetchGemini()` in route.ts retries once on HTTP 503, after 500ms delay. All other errors surface immediately.

---

## Correction mechanism

How the app replaces previously logged entries when the user corrects themselves.

**In `CoachRail.tsx`:**

```javascript
const lastAddedIdsRef = useRef<number[]>([]);

// After addEntries():
const entriesBefore = useStore.getState().entries;
addEntries(data.entries.map(e => ({ ...e, source })));
const entriesAfter = useStore.getState().entries;
lastAddedIdsRef.current = entriesAfter.slice(entriesBefore.length).map(e => e.id);

// When correction:true:
if (data.correction && lastAddedIdsRef.current.length > 0) {
  lastAddedIdsRef.current.forEach(id => removeEntry(id));
}
```

**End-to-end flow:**
1. User logs "two bananas" → IDs [5, 6] stored in `lastAddedIdsRef`.
2. User says "I meant yelakki" → Gemini returns `correction: true`, 2 yelakki entries.
3. CoachRail removes IDs [5, 6], then adds the yelakki entries → IDs [7, 8] now in `lastAddedIdsRef`.
4. If the user doesn't log anything in between (clarification question with `entries: []`), `lastAddedIdsRef` is NOT updated — a follow-up correction still works.

---

## localFallback — when Gemini is unavailable

`lib/coach.ts:localFallback()` runs when the API call fails (network error, 502, bad shape).

| Condition | Behavior |
|---|---|
| Text matches activity keywords | Log an activity entry (7 kcal/min estimate), `correction: false` |
| Text has no quantity signals | Ask for quantity, `needsClarification: true`, `correction: false` |
| Otherwise | "Something went wrong, try again", `needsClarification: true`, `correction: false` |

All three branches include `correction: false` — required field (TypeScript strict). Missing it breaks Vercel builds.

---

## Changelog

Listed newest-first. Each entry links to the real-world bug that drove the change.

### `beb8bea` — Estimate-friendly quantity clarification
**Bug:** Rule 2 blocked logging indefinitely when user said "I'm not sure of the exact amount."  
**Fix:** RULE 2 now explicitly says: if user is unsure, accept best guess and log. Offer 2–3 practical reference sizes for vague terms. Never block indefinitely.

### `6c8ce67` — Refactor RULE 2 to generic principle
**Bug:** RULE 2 had banana-specific wording ("if user says 'banana'...") — violating the principle that rules should be generic instructions applicable to any food.  
**Fix:** Rewrote RULE 2 as a generic behavioral principle: ask about quantity AND specificity for any food where they're ambiguous, not just named foods.

### `5d28778` — Ask banana variety before logging + fix yelakki calorie
**Bug:** LLM logged generic "banana" (89 kcal) when user said just "banana" — should have asked Medjool/dried/yelakki. Also computed 2×60=120 and applied that as per-entry kcal.  
**Fix:** Added specificity check to RULE 2; added per-banana USDA anchor to RULE 3.

### `91ec90b` — Corrections infer quantity from history
**Bug:** After user corrected "banana → yelakki", LLM asked "how many?" because RULE 2 fired.  
**Fix:** RULE 5 explicitly overrides RULE 2 for corrections: infer quantity from most recent logged item in history.

### `30c300b` — Fix build: add correction field to localFallback
**Bug:** Added `correction: boolean` as required field to `CoachResponse` but missed 3 return statements in `lib/coach.ts:localFallback`. TypeScript strict mode caught it at Vercel build time.  
**Fix:** Added `correction: false` to all 3 localFallback return statements.

### `6672328` — Correction mode replaces instead of appending
**Bug:** "I meant yelakki bananas" appended 2 new yelakki entries instead of replacing the 2 banana entries.  
**Fix:** Added `correction: boolean` to CoachResponse; added `lastAddedIdsRef` + removeEntry logic in CoachRail; added RULE 5 to system prompt.

### `c86ce74` — Remove dangling connector after stripWater
**Bug:** "I had two bananas with 600ml water" → stripped to "I had two bananas with" → LLM asked "with what?".  
**Fix:** Post-strip regex removes trailing `with/and/plus/along with/alongside`.

### `b387a35` — Switch to gemini-flash-lite-latest + retry on 503
**Bug:** `gemini-2.5-flash-lite` returned persistent 503s — model overloaded on free tier.  
**Fix:** Switched to `gemini-flash-lite-latest` (stable free-tier alias). Added 503 retry with 500ms delay.

### `f6b97ce` — Upgrade to gemini-2.5-flash-lite (later reverted)
**Bug:** `gemini-1.5-flash` returned 404 — model removed from v1beta API.  
**Fix attempted:** Upgraded to `gemini-2.5-flash-lite`. Later caused 503s (see above).

### `28d26b7` — Surface API error instead of hardcoded 400 kcal fallback
**Bug:** localFallback was returning a hardcoded 400 kcal food entry when no matching condition hit.  
**Fix:** Changed final fallback to surface "Something went wrong, try again" with needsClarification:true.

### `387df9e` — Strip water pre-LLM with atomic regex
**Bug:** "600ml water and two dates" → LLM logged water as a 0 kcal entry (bundled with dates).  
**Fix:** `stripWater()` removes water phrases before text reaches Gemini. Also handles coconut water guard.

### `ccb6f7a` — System instruction + code-level water filter
**Bug:** Earlier fix added "water = 0 kcal" to prompt but LLM still occasionally bundled water.  
**Fix:** Moved water logic from prompt rule to code-level preprocessing (stripWater). Added ZERO_CAL_ENTRY backstop filter in normalize().

### `8bf6e13` — Initial fix: water logged as calories, questions as food
**Bug:** "I drank 600ml water" → logged as 400 kcal. "How many calories is that?" → logged as food entry.  
**Fix:** Added water=0 rule and question-detection rule to prompt.

---

## Known limitations

- `lastAddedIdsRef` is session-scoped (React ref). If the user refreshes mid-conversation and then tries to correct, the previous entries are gone from the ref — correction will add new entries instead of replacing. Not a critical bug (user can delete manually) but worth noting.
- `history` is capped at 6 messages. Very long back-and-forth before a correction might lose the original logged quantity, causing RULE 5's quantity inference to fail.
- Free-tier Gemini has no guaranteed SLA. The 503 retry helps transient spikes but sustained overload will fall through to `localFallback`.
- `gemini-flash-lite-latest` is an alias — Google may point it at a different model version without notice. If behavior regresses suddenly, check Gemini changelog.
