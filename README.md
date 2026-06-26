# Tempo — Next.js starter scaffold

A minimal, runnable **Next.js (App Router) + TypeScript** skeleton wired for the Tempo app. It gives you the plumbing — types, a Zustand store, the goal-math, and the LLM + Strava API routes — so you (and Claude Code) can focus on building the UI from the design reference.

> The screen-by-screen design spec lives in the parent folder's `../README.md`, with the pixel-accurate source in `../Tempo.dc.html`. **This scaffold is the wiring; that README is the look.**

## What's included
```
starter/
├─ app/
│  ├─ layout.tsx              # root layout, fonts, globals
│  ├─ globals.css             # design tokens (CSS vars) + resets
│  ├─ page.tsx                # entry: routes onboarding ↔ app shell (stub)
│  └─ api/
│     ├─ coach/route.ts       # POST → parses food/activity via Gemini, returns the JSON contract
│     └─ strava/
│        ├─ connect/route.ts  # GET → redirects to Strava OAuth
│        └─ callback/route.ts # GET → exchanges code for tokens (stub)
├─ lib/
│  ├─ types.ts                # Entry, Profile, Tracking, Goal, CoachResponse…
│  ├─ tokens.ts               # color/spacing constants (mirror of globals.css)
│  ├─ compute.ts              # computeGoals() — Mifflin-St Jeor → TDEE → targets
│  ├─ store.ts                # Zustand store: profile, entries, messages, wizard state
│  └─ coach.ts                # client helper: callCoach(text, ctx) → CoachResponse
├─ .env.example
├─ package.json
├─ tsconfig.json
└─ next.config.mjs
```

## Setup
```bash
cp .env.example .env.local      # then fill in GEMINI_API_KEY (+ Strava keys when ready)
npm install
npm run dev                     # http://localhost:3000
```

## What to build next (UI)
The store, math, and APIs are ready. Implement the screens from `../README.md`:
1. **App shell + Today** — sidebar, energy ring, macro bars, log, coach rail (reads/writes the store; coach input calls `callCoach`).
2. **Onboarding wizard** — 5 steps driven by `store.obStep` (`login→track→questions→body→goals`); `computeGoals()` runs on entry to `goals`.
3. **Trends / Foods / Settings** and the **food-detail slide-over**.

Lift exact hex, type scale, and spacing from `../Tempo.dc.html` (or the CSS vars in `globals.css`).

## What's stubbed (make real)
- **Auth & persistence** — the login step just seeds `profile.name`. Add real auth (NextAuth/Clerk/Supabase) and persist `profile`, `entries`, `messages` to a DB (Postgres/Supabase recommended).
- **/api/coach** — works as-is with a free **Gemini** key (`GEMINI_API_KEY`, get one at https://aistudio.google.com/apikey). Tune the model via `GEMINI_MODEL` (default `gemini-1.5-flash`). With no key, the client falls back to a local estimator that still asks for quantity.
- **/api/strava/** — OAuth scaffold; the callback's token exchange + activity sync + **dedupe** (voice vs synced workout) are TODOs flagged in code.
- **Voice** — Web Speech API in the browser (see `../README.md` → Voice input). Needs HTTPS + a top-level origin.
