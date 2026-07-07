# Tempo — Next.js starter scaffold

A minimal, runnable **Next.js (App Router) + TypeScript** skeleton wired for the Tempo app. It gives you the plumbing — types, a Zustand store, the goal-math, and the LLM API route — so you (and Claude Code) can focus on building the UI from the design reference.

> The screen-by-screen design spec lives in the parent folder's `../README.md`, with the pixel-accurate source in `../Tempo.dc.html`. **This scaffold is the wiring; that README is the look.**

## What's included
```
starter/
├─ app/
│  ├─ layout.tsx              # root layout, fonts, globals
│  ├─ globals.css             # design tokens (CSS vars) + resets
│  ├─ page.tsx                # entry: routes onboarding ↔ app shell
│  ├─ components/
│  │  └─ CoachRail.tsx        # coach chat UI, voice input, correction mechanism
│  └─ api/
│     ├─ auth/                # Supabase auth callback
│     └─ coach/route.ts       # POST → stripWater → Gemini → structured CoachResponse
├─ lib/
│  ├─ types.ts                # Entry, Profile, Tracking, Goal, CoachResponse, CoachContext…
│  ├─ tokens.ts               # color/spacing constants (mirror of globals.css)
│  ├─ compute.ts              # computeGoals() — Mifflin-St Jeor → TDEE → targets
│  ├─ store.ts                # Zustand store: profile, entries, messages, wizard state + Supabase sync
│  └─ coach.ts                # client helper: callCoach(text, ctx) → CoachResponse + localFallback
├─ COACH.md                   # AI coach architecture, rules, model history, changelog
├─ .env.example
├─ package.json
├─ tsconfig.json
└─ next.config.mjs
```

## Setup
```bash
cp .env.example .env.local      # fill in GEMINI_API_KEY and Supabase keys
npm install
npm run dev                     # http://localhost:3000
```

## What to build next (UI)
The store, math, and APIs are ready. Implement the screens from `../README.md`:
1. **App shell + Today** — sidebar, energy ring, macro bars, log, coach rail (reads/writes the store; coach input calls `callCoach`).
2. **Onboarding wizard** — 5 steps driven by `store.obStep` (`login→track→questions→body→goals`); `computeGoals()` runs on entry to `goals`.
3. **Trends / Foods / Settings** and the **food-detail slide-over**.

Lift exact hex, type scale, and spacing from `../Tempo.dc.html` (or the CSS vars in `globals.css`).

## What's live
- **Auth & persistence** — Supabase auth (Google OAuth). Profile, goals, entries, and messages all sync to Supabase on every write.
- **/api/coach** — production-ready. Uses Google Gemini (`gemini-flash-lite-latest` on free tier). Handles food/activity logging, quantity clarification, corrections, water stripping. See `COACH.md` for full architecture.
- **Voice** — Web Speech API in `CoachRail.tsx`. Works on HTTPS + Chrome/Edge. Falls back gracefully with an error message on unsupported browsers.

## What's still stubbed
- **Trends / Foods / Settings** — UI screens not yet built. Store and types are ready.
- **Food detail slide-over** — not yet implemented.
- **Step / water tracking UI** — tracked in store, no UI yet.
