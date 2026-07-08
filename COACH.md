# Tempo — AI Coach Reference

Bootstrap context for new sessions. Read this before touching any coach-related code.

---

## What the coach does

The coach is a conversational food/activity logger. The user types or speaks what they ate or did. The coach parses natural language, asks clarifying questions when quantity or specificity is unclear, and returns structured entries that land in the Zustand store.

It does **not** track water (stripped pre-LLM). It does not log the coach's own questions as food entries. It does not treat verification questions as correction requests.

---

## Request flow

```
User input (text or voice)
  ↓ CoachRail.tsx: submit()
      ↓ build logSummary from store entries ("elaichi banana (60 kcal), ...")
      ↓ build ctx: CoachContext (totals + logSummary + history)
  ↓ lib/coach.ts: callCoach(text, ctx)  — client helper
  ↓ POST /api/coach                     — Next.js route
      ↓ stripWater(text)                — pre-LLM preprocessing
      ↓ buildUserTurn(cleanedText, ctx) — inject context + Today's log
      ↓ Gemini API (gemini-flash-lite-latest)
      ↓ parseJson() → normalize()
  ↓ CoachResponse returned to CoachRail
  ↓ correction? → name-based lookup via correctionTargets[] before addEntries()
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
| `lib/store.ts` | addEntries, removeEntry, pushMessage, Supabase sync |
| `middleware.ts` | Supabase SSR session refresh (JWT) |
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
  correction: boolean,           // true → remove targets before logging
  correctionTargets: string[],   // ALL entry names to remove (exact names from Today's log)
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

`normalize()` in route.ts enforces this shape on whatever Gemini returns — coerces types, clamps negatives, strips pure-water entries, ensures `correctionTargets` is always an array.

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
  logSummary:    string,   // "elaichi banana (60 kcal), walnuts (52 kcal)"
}
```

`history` is the last 6 store messages — gives the LLM context for corrections without blowing the prompt.

`logSummary` is the **exact names and kcal of every entry currently in the store**, joined with commas. This is what the LLM copies verbatim into `correctionTargets` so the client can do a reliable name-based lookup. Built in `CoachRail.tsx:submit()`:

```javascript
const logSummary = state.entries.length > 0
  ? state.entries.map(e => `${e.name} (${e.kcal} kcal)`).join(', ')
  : 'empty';
```

Both are injected into the user turn via `buildUserTurn()`:

```
Goal "Weight loss": 1600 kcal/day net. Today: eaten 120 kcal, burned 0 kcal, net 120 kcal, protein 0g / 120g.
Today's log: elaichi banana (60 kcal), elaichi banana (60 kcal)
Recent conversation:
User: two elaichi bananas
Coach: Logged! Two elaichi bananas at 60 kcal each, 120 kcal total.
User: "actually those were regular bananas"
```

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

**b) SPECIFICITY** — When in doubt, ask. If size, variety, type, or preparation could meaningfully change the calorie count, always ask — do not assume. Examples: a walnut (small/medium/large), a date (Medjool/Ajwa/dried), a banana (regular/elaichi). **Default to asking rather than guessing.**

Ask ONE question covering all missing info together.

**Why:** Without this, the LLM logged unspecified "bananas" using standard banana calories when yelakki/elaichi bananas are ~33% fewer kcal. Also blocked logging when users said "I'm not sure exactly" — rule now explicitly says accept best guesses. The "default to asking" line was added after the LLM logged "one walnut" without asking for size.

**Important:** RULE 5 overrides RULE 2 for corrections (see below).

---

### RULE 3 — ACCURATE USDA CALORIES
USDA anchors baked into the prompt:
- 1 Medjool date = 66 kcal
- 1 small dried date = 20 kcal
- 1 Ajwa date (small) = 40 kcal
- 1 large egg = 72 kcal
- 1 cup cooked white rice = 206 kcal
- 1 medium banana = 89 kcal
- 1 yelakki/elaichi/small Indian banana = 60 kcal
- 100 g chicken breast = 165 kcal
- 1 slice bread = 79 kcal
- 1 small walnut half = 13 kcal
- 1 medium walnut half = 20 kcal

**Why:** LLM was computing per-banana kcal correctly (60) but then applying that total to each of two entries instead of splitting. Ajwa date and walnut sizes added after user reported those foods being logged incorrectly.

---

### RULE 4 — USER QUESTIONS & VERIFICATION
If the user is questioning, verifying, or asking about what was logged — including "have you logged X or Y?", "did you log it as medium or small?", "what size did you log?", "how is that X calories?", "that seems wrong" — return `entries: []` and address the concern in `reply`. Do NOT log, correct, or change anything. A question is **never** a correction request. Only act under RULE 5 when the user explicitly says to change or correct something.

**Why:** Two failure modes were fixed here: (1) LLM logged the user's question as a food entry (e.g. "how many calories is that?" → 0 kcal food). (2) LLM treated "have you logged X or Y?" as a correction request and removed entries.

---

### RULE 5 — CORRECTIONS & DELETIONS
Two sub-cases, both use `correction:true`:

**Correction (replace):** User says they logged something wrong ("I meant yelakki", "actually 3 not 2", "those were Medjool") → return corrected entries with `correction:true`, `correctionTargets:[all names to remove from Today's log]`, `entries:[corrected items]`. Infer quantity from Today's log if not re-stated — do NOT ask (overrides RULE 2).

**Deletion (pure remove):** User says to remove something ("remove the dates", "delete the walnut", "I didn't have X after all") → return `correction:true`, `correctionTargets:[all matching names from Today's log]`, `entries:[]` — pure removal, nothing added.

All other cases: `correction:false`, `correctionTargets:[]`.

**Why:** Three bugs drove this rule's evolution:
1. "I meant yelakki bananas" appended new entries instead of replacing → needed `correction: true` flag.
2. After `correction: true`, LLM still asked "how many?" because RULE 2 fired → needed RULE 5 override.
3. Correcting "3 Ajwa dates" left one entry behind — single string → upgraded to `correctionTargets: string[]`.
4. "Remove the dates" did nothing — RULE 5 didn't cover deletion, and CoachRail skipped removal logic when `entries:[]` → added deletion sub-case to RULE 5 and moved removal block outside the `entries.length > 0` guard.

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

**Removal step — always runs first when `correction:true`:**

```javascript
if (data.correction) {
  const targets = (data.correctionTargets || [])
    .map(t => t.toLowerCase().trim()).filter(Boolean);
  if (targets.length > 0) {
    const current = useStore.getState().entries;
    const toRemove = current.filter(e => {
      const eName = e.name.toLowerCase();
      return targets.some(t => eName === t || eName.includes(t) || t.includes(eName));
    });
    toRemove.forEach(e => removeEntry(e.id));
  } else if (lastAddedIdsRef.current.length > 0) {
    lastAddedIdsRef.current.forEach(id => removeEntry(id));
  }
}
if (data.entries.length > 0) {
  // add replacement entries and update lastAddedIdsRef
}
```

Removal runs regardless of whether `entries` is empty — this is what makes pure deletion work (coach says "remove X" → `correction:true`, `entries:[]` → targets removed, nothing added).

The LLM copies exact entry names from `Today's log` into `correctionTargets`. The three-way match (`===`, `includes`, `t.includes(eName)`) handles minor name drift across turns.

**End-to-end — correction (replace):**
1. User logs "two Ajwa dates" → IDs [5, 6] in `lastAddedIdsRef`.
2. User says "actually those were Medjool" → Gemini: `correction:true`, `correctionTargets:["Ajwa date","Ajwa date"]`, 2 Medjool entries.
3. CoachRail removes both Ajwa entries by name, adds 2 Medjool entries.

**End-to-end — deletion (pure remove):**
1. User logs "three Ajwa dates" → IDs [5, 6, 7].
2. User says "remove the dates" → Gemini: `correction:true`, `correctionTargets:["Ajwa date","Ajwa date","Ajwa date"]`, `entries:[]`.
3. CoachRail removes all three by name, adds nothing.

**Fallback:** If `correctionTargets` is empty (shouldn't happen), falls back to `lastAddedIdsRef`.

---

## localFallback — when Gemini is unavailable

`lib/coach.ts:localFallback()` runs when the API call fails (network error, 502, bad shape).

| Condition | Behavior |
|---|---|
| Text matches activity keywords | Log an activity entry (7 kcal/min estimate), `correction: false`, `correctionTargets: []` |
| Text has no quantity signals | Ask for quantity, `needsClarification: true`, `correction: false`, `correctionTargets: []` |
| Otherwise | "Something went wrong, try again", `needsClarification: true`, `correction: false`, `correctionTargets: []` |

All three branches include **both** `correction: false` and `correctionTargets: []` — both are required fields (TypeScript strict). Missing either breaks Vercel builds.

---

## Supabase schema

Tables created in Supabase SQL editor. RLS enabled on all four tables.

```sql
-- profiles (one row per user)
create table profiles (
  id uuid primary key references auth.users,
  name text, goal_type text, water numeric, steps int,
  sex text, activity text, pace text, age int,
  weight_kg numeric, height_cm numeric, target_weight_kg numeric,
  tracking jsonb, updated_at timestamptz
);
alter table profiles enable row level security;
create policy "own profile" on profiles using (auth.uid() = id);

-- goals (up to 3 rows per user: lose/maintain/gain)
create table goals (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  type text, title text, "desc" text, target int,
  protein_target int, carb_target int, fat_target int,
  unique(user_id, type)
);
alter table goals enable row level security;
create policy "own goals" on goals using (auth.uid() = user_id);

-- entries (daily food/activity logs)
create table entries (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  entry_date date not null,
  local_id int, time text, type text, name text,
  kcal int, protein int, carbs int, fat int,
  duration_min int, source text
);
alter table entries enable row level security;
create policy "own entries" on entries using (auth.uid() = user_id);

-- messages (daily coach conversation)
create table messages (
  pk bigserial primary key,
  user_id uuid references auth.users not null,
  message_date date not null,
  role text, text text
);
alter table messages enable row level security;
create policy "own messages" on messages using (auth.uid() = user_id);
```

**Note:** `"desc"` must be quoted — it's a reserved SQL keyword.

### Supabase sync strategy
All DB writes are fire-and-forget from `lib/store.ts`. Errors are logged via `console.error('[tempo] ...')` but never surface to the user. `dbReplaceEntries` does a full delete-then-insert for today's entries on every change — simple, correct, not optimized for high volume.

### Data load on login
`initFromSupabase()` in `store.ts` runs after Google OAuth. It reads `profiles`, `goals`, `entries` (today only), and `messages` (today only) in parallel. Returning users go straight to `screen: 'today'`; new users (no profile row) start onboarding.

---

## Middleware

`middleware.ts` refreshes the Supabase JWT on every request using `createServerClient` + `await supabase.auth.getUser()`. This is **required** for Supabase SSR — without it, server-side auth tokens expire and data reads fail silently.

The previous version was a no-op (`return NextResponse.next()`) which caused data to not persist across page reloads for returning users.

---

## Mobile layout

Mobile uses a different rendering path than desktop in `AppShell.tsx`.

**Pattern:** Both the top bar and the main content area use `position: fixed` — the same approach as the CoachRail overlay — because it gives a rock-solid height contract (explicit `top`/`bottom`) that works regardless of `dvh` unit support or flex height chain quirks.

```
AppShell mobile:
  <div>  {/* plain wrapper, no height */}
    top bar:  position: fixed, top: 0, left: 0, right: 0, height: MOBILE_TOP_H, zIndex: 20
    content:  position: fixed, top: MOBILE_TOP_H, left: 0, right: 0, bottom: 0,
              overflowY: auto, WebkitOverflowScrolling: touch
    overlays: position: fixed, zIndex: 49 (left nav + right coach, scrim at zIndex 48)
  </div>
```

**Why not flex + `100dvh`:** The initial implementation used `height: 100dvh` on the outer container with a flex column. `100dvh` has inconsistent support on older mobile browsers; when it falls back, the outer container gets content-height, which breaks the flex chain and `overflowY: auto` never triggers. CoachRail worked because its overlay uses `position: fixed, top: 0, bottom: 0`.

**Screen components on mobile:** Each screen (`Today`, `Trends`, `Foods`, `Settings`) has `flex: 1, overflowY: auto` on its root div. In the fixed parent (not a flex container), `flex: 1` is a no-op. Their `overflowY: auto` doesn't trigger either (no height constraint on them individually). The **parent fixed div is the scroll container** — all screen content scrolls as one block.

**Desktop:** Unchanged 3-column flex layout with `height: 100vh`. Screen components' `flex: 1, overflowY: auto` works normally there.

**Key constant:** `MOBILE_TOP_H = 52` (px) — height of the fixed top bar.

---

## Changelog

Listed newest-first.

### Session 2026-07g — delete account feature

#### Delete account (Settings + API route)
**What:** Users can now delete their account and all data from Settings → Account card. A "Delete account" button sits next to Sign out. Clicking it shows an inline confirmation ("This will delete all your data permanently. Are you sure?") with "Yes, delete everything" and "Cancel". On confirm: calls `DELETE /api/delete-account`, signs out, redirects to `/login`.  
**How it works:**
- `app/api/delete-account/route.ts` — server route using the Supabase admin client (`SUPABASE_SERVICE_ROLE_KEY`). Deletes all user rows from `messages` → `entries` → `goals` → `profiles` in order, then calls `admin.auth.admin.deleteUser(userId)` to remove the auth record. Returns 401 if called unauthenticated.
- `Settings.tsx` — `AccountCard` component extracted from inline JSX; uses `useState` for `confirming`/`deleting`/`error` states. Error message shown inline if the API call fails.
- `.env.local` + Vercel env vars — `SUPABASE_SERVICE_ROLE_KEY` added to both.  
**Why:** Users had no way to remove their account or data from the app.  
**Files:** `app/api/delete-account/route.ts` (new), `Settings.tsx`, `.env.local`.

---

### Session 2026-07f — activity options, pace label, coach kcal in reply

#### Remove "Very active" activity option
**What:** Removed `{ value: 'very', label: 'Very active', sub: 'Daily / physical job' }` from `ACTIVITY_DEFS`. Updated `Active` sub-text from `5–6 days a week` → `5–7 days a week` to cover the full upper range.  
**Files:** `Onboarding.tsx`.

#### Rename "Weekly pace" heading
**What:** Changed section label from `Weekly pace` → `How fast do you want to reach your goal?` for clarity.  
**Files:** `Onboarding.tsx`.

#### Coach reply includes total kcal when logging
**What:** Updated `reply` instruction in the SYSTEM prompt to require the LLM to include total kcal in its confirmation when entries are logged, e.g. `"Logged! Two large boiled eggs — 144 kcal."`.  
**Files:** `app/api/coach/route.ts`.

---

### Session 2026-07e — starter prompts, empty state, onboarding + settings cleanup

#### Starter prompts in CoachRail
**What:** When `entries.length === 0 && !thinking`, four tappable example chips appear above the composer: "Two eggs and toast", "30 min walk", "Cup of chai with milk", "100g chicken breast". Clicking a chip calls `submit(prompt, 'text')` directly — same path as typing. Chips disappear as soon as anything is logged.  
**Why:** New users had no signal on what to say to the coach. The empty state text ("tell the coach what you ate or did") was not enough.  
**Files:** `CoachRail.tsx` — added `entries` store selector, added chips section between mic error and composer.

#### Today empty state card
**What:** Replaced the plain grey text ("No entries yet…") with a card containing a coach icon, "Nothing logged yet" headline, and directional text. On mobile: "Tap the chat icon in the top-right…" + an "Open coach" button that calls `onOpenCoach()` to open the overlay directly. On desktop: "Use the coach panel on the right".  
**Files:** `Today.tsx` — added `onOpenCoach?: () => void` prop. `AppShell.tsx` — passes `onOpenCoach={() => setRightOpen(true)}` to both desktop and mobile `<Today>` instances.

#### Onboarding: back button on step 1 signs out
**What:** `obBack` on step 0 (`StepTrack`) was a no-op. Now calls `supabase.auth.signOut()` then `window.location.href = '/login'`.  
**Files:** `Onboarding.tsx`.

#### Onboarding: Water intake + Step count marked coming soon
**What:** Both items in `TRACK_DEFS` now have `comingSoon: true` — non-clickable, 0.6 opacity, "Coming soon" pill badge, muted background. Cannot be toggled so never written to the store.  
**Files:** `Onboarding.tsx`.

#### Onboarding goals step: water + steps blocks removed
**What:** The Water intake and Step count editable fields in `StepGoals` were removed. These features have no backend implementation.  
**Files:** `Onboarding.tsx`.

#### Focus card in onboarding goals step and Settings
**What:** Green summary card ("YOUR FOCUS" label, target line, live timeline) added to the top of `StepGoals` and inside the "Your goal" card in Settings.  
- Target line: "Lose X kg" / "Gain X kg" / "Maintain X kg"  
- Timeline: `weeks = (weightDelta × 7700) / (dailyDeficit × 7)` where `dailyDeficit = TDEE − goal.target`. Shown for `lose` only when `dailyDeficit > 0`. No timeline for `gain` or `maintain`.  
- TDEE re-derived from Mifflin-St Jeor (same as `compute.ts`) using store fields: `sex`, `activity`, `age`, `weightKg`, `heightCm`.  
- Recalculates live when user edits the daily kcal field.  
**Files:** `Onboarding.tsx`, `Settings.tsx`.

#### Settings: mobile-responsive padding
**What:** Settings outer div padding changed from fixed `32px 40px` to `isMobile ? '20px 16px' : '32px 40px'`.  
**Files:** `Settings.tsx`.

### Session 2026-07d — fix mobile scroll for all screens

**Bug:** Scrolling only worked in the CoachRail overlay; Today, Trends, Foods, Settings didn't scroll on mobile.

**Root cause:** The outer container used `height: 100dvh` with a flex column. `100dvh` has inconsistent support on older mobile browsers — when it falls back, the outer container collapses to content height, breaking the flex chain so `overflowY: auto` on the screen components never triggers. CoachRail worked because its overlay uses `position: fixed, top: 0, bottom: 0` (explicit pixel bounds).

**Fix:** Replaced the flex-column layout with `position: fixed` for both the top bar and the main content div — the same pattern as CoachRail. The main content has `top: 52px, bottom: 0` → definite height without relying on viewport units. `overflowY: auto` + `-webkit-overflow-scrolling: touch` on the main content div make all screens scrollable.

Files changed: `AppShell.tsx` (mobile layout section only).

### Session 2026-07c — fix duplicate entries on correction

#### Race condition: all entries duplicated after a correction
**Bug:** Corrections triggered N+1 concurrent `dbReplaceEntries` calls: one per `removeEntry(id)` call, plus one from `addEntries`. Each call does DELETE-then-INSERT. When two calls race, both DELETEs succeed, then both INSERTs fire — leaving the pre-removal entries in Supabase twice. On next page load, `initFromSupabase` reads the doubled rows and shows all entries duplicated.

**Fix:**
1. Added `replaceEntries(removeIds, newEntries)` action to `store.ts` — atomically filters out removed entries and appends new ones in a **single** Zustand `set` call → single `dbReplaceEntries` call. No concurrent writes possible.
2. Rewrote CoachRail correction/deletion block to call `replaceEntries` instead of looping `removeEntry` + calling `addEntries` separately.
3. Added dedup on load in `initFromSupabase`: filters entries by `local_id` uniqueness before mapping, so any existing Supabase duplicates are silently ignored on next load.

### Session 2026-07b — coach deletion, quick-delete UI, editable macros

#### Coach can delete entries ("remove the dates", "I didn't have X")
**Bug:** Asking the coach to "remove" or "delete" a logged entry did nothing — RULE 5 only covered corrections (replace), not pure deletions. Also `CoachRail` skipped the entire removal block when `entries: []`, so even if the LLM had returned a deletion response it wouldn't have worked.  
**Fix:** Extended RULE 5 to cover deletion requests: returns `correction:true`, `correctionTargets:[matching names]`, `entries:[]`. Fixed `CoachRail` to run the removal logic whenever `correction:true`, regardless of whether `entries` is empty — pure deletion now removes the targets and adds nothing.

#### Quick-delete trash icon on log rows (Today.tsx)
**Bug:** Removing multiple same-name entries required opening the SlideOver for each one individually.  
**Fix:** Added a trash icon to each `LogRow` that appears on hover. Click fires `removeEntry` directly — `stopPropagation` prevents the SlideOver from opening. No prop threading needed; uses the store directly.

#### Editable protein / carbs / fat in SlideOver
**Bug:** Macro values (protein, carbs, fat) were display-only bars — only kcal was editable.  
**Fix:** Replaced static gram values with inline inputs identical in style to the kcal input. Each input calls `updateEntry` on change with the field name. Bar width stays live (recalculates from current entry values on re-render). Edit hint line updated to "Click any number to edit it."

### Session 2026-07 — correction array, logSummary, verification questions, Supabase

#### `correctionTargets` array (replaces `correctionTarget` string)
**Bug:** Correcting "3 Ajwa dates" (three separate entries) still left one entry behind — single `correctionTarget` string only removed the first match.  
**Fix:** Changed `CoachResponse.correctionTarget: string` → `correctionTargets: string[]`. LLM now lists ALL entry names to remove. `normalize()` coerces to array. Correction logic in `CoachRail` iterates all targets. `localFallback` updated to include `correctionTargets: []`.

#### `logSummary` in CoachContext
**Bug:** LLM was guessing entry names from conversation history, which differed from actual stored names, causing `correctionTargets` lookup to miss.  
**Fix:** Added `logSummary: string` to `CoachContext` — exact stored entry names with kcal. Passed to LLM in `buildUserTurn` as `Today's log: ...`. LLM now copies names verbatim.

#### RULE 4 — verification questions
**Bug:** "Have you logged X or Y?" treated as a correction request — LLM removed entries when user was just verifying.  
**Fix:** RULE 4 explicitly lists verification question patterns and clarifies these are never corrections.

#### RULE 2 — "default to asking rather than guessing"
**Bug:** "Add one walnut" logged immediately without asking size.  
**Fix:** Added explicit "Default to asking rather than guessing" to RULE 2b, with walnut as an example.

#### RULE 3 — Ajwa date + walnut size anchors
**Fix:** Added `1 Ajwa date (small) = 40 kcal`, `1 small walnut half = 13 kcal`, `1 medium walnut half = 20 kcal`.

#### Middleware fix — session persistence
**Bug:** Returning users saw blank data on page reload — JWT had expired, Supabase reads silently returned null.  
**Fix:** Replaced no-op middleware with proper JWT refresh using `createServerClient` + `getUser()`.

#### Supabase schema + RLS
**Fix:** Created all four tables (`profiles`, `goals`, `entries`, `messages`) with RLS. Previously no tables existed — all DB writes silently failed.

#### DB error logging in store.ts
**Fix:** All four DB helpers now log errors via `console.error('[tempo] ...]')`. `dbReplaceEntries` returns early if delete fails.

---

### Pre-2026-07 changelog

### `beb8bea` — Estimate-friendly quantity clarification
**Bug:** Rule 2 blocked logging indefinitely when user said "I'm not sure of the exact amount."  
**Fix:** RULE 2 now says: if user is unsure, accept best guess and log.

### `6c8ce67` — Refactor RULE 2 to generic principle
**Bug:** RULE 2 had banana-specific wording — violating generic instruction principle.  
**Fix:** Rewrote RULE 2 as a generic behavioral principle applicable to any food.

### `5d28778` — Ask banana variety before logging + fix yelakki calorie
**Bug:** LLM logged generic "banana" (89 kcal) without asking variety. Computed 2×60=120 and applied as per-entry kcal.  
**Fix:** Added specificity check to RULE 2; added per-banana USDA anchor to RULE 3.

### `91ec90b` — Corrections infer quantity from history
**Bug:** After "banana → yelakki", LLM asked "how many?" because RULE 2 fired.  
**Fix:** RULE 5 overrides RULE 2: infer quantity from most recent logged item.

### `30c300b` — Fix build: add correction field to localFallback
**Bug:** Added `correction: boolean` as required field but missed 3 return statements in `localFallback`. TypeScript strict caught it at Vercel build.  
**Fix:** Added `correction: false` to all 3 localFallback return statements.

### `6672328` — Correction mode replaces instead of appending
**Bug:** "I meant yelakki bananas" appended 2 new entries instead of replacing.  
**Fix:** Added `correction: boolean` to CoachResponse; added `lastAddedIdsRef` + removeEntry logic; added RULE 5.

### `c86ce74` — Remove dangling connector after stripWater
**Bug:** "I had two bananas with 600ml water" → stripped to "I had two bananas with" → LLM asked "with what?".  
**Fix:** Post-strip regex removes trailing `with/and/plus/along with/alongside`.

### `b387a35` — Switch to gemini-flash-lite-latest + retry on 503
**Bug:** `gemini-2.5-flash-lite` returned persistent 503s on free tier.  
**Fix:** Switched to `gemini-flash-lite-latest`. Added 503 retry with 500ms delay.

### `f6b97ce` — Upgrade to gemini-2.5-flash-lite (later reverted)
**Bug:** `gemini-1.5-flash` returned 404 — removed from v1beta API.  
**Fix attempted:** Upgraded to `gemini-2.5-flash-lite`. Later caused 503s.

### `28d26b7` — Surface API error instead of hardcoded 400 kcal fallback
**Bug:** localFallback returned a hardcoded 400 kcal food entry as the final else branch.  
**Fix:** Changed to "Something went wrong, try again" with `needsClarification: true`.

### `387df9e` — Strip water pre-LLM with atomic regex
**Bug:** "600ml water and two dates" → LLM logged water as a 0 kcal entry.  
**Fix:** `stripWater()` removes water phrases before text reaches Gemini. Coconut water guarded.

### `ccb6f7a` — System instruction + code-level water filter
**Bug:** Earlier prompt-level fix still occasionally let water through.  
**Fix:** Moved water logic to `stripWater()` preprocessing. Added `ZERO_CAL_ENTRY` backstop in `normalize()`.

### `8bf6e13` — Initial fix: water logged as calories, questions as food
**Bug:** "I drank 600ml water" → logged as 400 kcal. "How many calories is that?" → logged as food.  
**Fix:** Added water=0 rule and question-detection rule to prompt.

---

## Known limitations

- `lastAddedIdsRef` is session-scoped (React ref). If the user refreshes mid-conversation and then corrects, the ref is empty — correction falls back to name-based `correctionTargets` lookup, which still works as long as entries are in the store (they will be after the middleware fix).
- `history` is capped at 6 messages. Very long back-and-forth before a correction might lose the original logged quantity, causing RULE 5's quantity inference to fail.
- Free-tier Gemini has no guaranteed SLA. The 503 retry helps transient spikes but sustained overload will fall through to `localFallback`.
- `gemini-flash-lite-latest` is an alias — Google may point it at a different model version without notice. If behavior regresses suddenly, check Gemini changelog.
- `dbReplaceEntries` does a full delete-then-insert on every entry change. Fine for light use; not optimized for high frequency logging.
