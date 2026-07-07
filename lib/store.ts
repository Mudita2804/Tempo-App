'use client';

import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase/client';
import type {
  Activity, Entry, Goal, Message, ObStep, Pace, Profile, Sex, Source, Tracking,
} from './types';
import { computeGoals } from './compute';

const DEFAULT_GOALS: Goal[] = [
  { type: 'lose',     title: 'Weight loss',   desc: 'Gentle deficit',  target: 1600, proteinTarget: 120, carbTarget: 200, fatTarget: 60 },
  { type: 'maintain', title: 'Maintain',       desc: 'Stay steady',     target: 2000, proteinTarget: 110, carbTarget: 240, fatTarget: 67 },
  { type: 'gain',     title: 'Build muscle',   desc: 'Slight surplus',  target: 2400, proteinTarget: 160, carbTarget: 280, fatTarget: 80 },
];

const DEFAULT_MESSAGES: Message[] = [
  { role: 'coach', text: "Hi — I'm your coach. Tell me what you eat or do, by voice or text. I'll ask for the amount whenever it's unclear, so your calories stay accurate." },
];

export type Screen = 'onboarding' | 'today' | 'trends' | 'foods' | 'settings';

const ORDER: ObStep[] = ['track', 'questions', 'body', 'goals'];
const todayStr = () => new Date().toISOString().split('T')[0];
const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ─── Supabase sync helpers (fire-and-forget) ──────────────────────────────────

async function dbSaveProfile(userId: string, s: Pick<State,
  'profile' | 'sex' | 'activity' | 'pace' | 'age' | 'weightKg' | 'heightCm' | 'targetWeightKg' | 'tracking'
>) {
  const db = createClient();
  const { error } = await db.from('profiles').upsert({
    id: userId,
    name: s.profile.name,
    goal_type: s.profile.goalType,
    water: s.profile.water,
    steps: s.profile.steps,
    sex: s.sex,
    activity: s.activity,
    pace: s.pace,
    age: s.age,
    weight_kg: s.weightKg,
    height_cm: s.heightCm,
    target_weight_kg: s.targetWeightKg,
    tracking: s.tracking,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('[tempo] dbSaveProfile failed:', error.message);
}

async function dbSaveGoals(userId: string, goals: Goal[]) {
  const db = createClient();
  const { error } = await db.from('goals').upsert(
    goals.map(g => ({
      user_id: userId,
      type: g.type,
      title: g.title,
      desc: g.desc,
      target: g.target,
      protein_target: g.proteinTarget,
      carb_target: g.carbTarget,
      fat_target: g.fatTarget,
    })),
    { onConflict: 'user_id,type' }
  );
  if (error) console.error('[tempo] dbSaveGoals failed:', error.message);
}

async function dbReplaceEntries(userId: string, entries: Entry[]) {
  const db = createClient();
  const date = todayStr();
  const { error: delError } = await db.from('entries').delete().eq('user_id', userId).eq('entry_date', date);
  if (delError) { console.error('[tempo] dbReplaceEntries delete failed:', delError.message); return; }
  if (entries.length > 0) {
    const { error: insError } = await db.from('entries').insert(
      entries.map(e => ({
        user_id: userId,
        entry_date: date,
        local_id: e.id,
        time: e.time,
        type: e.type,
        name: e.name,
        kcal: e.kcal,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
        duration_min: e.durationMin,
        source: e.source,
      }))
    );
    if (insError) console.error('[tempo] dbReplaceEntries insert failed:', insError.message);
  }
}

async function dbAppendMessages(userId: string, msgs: Message[]) {
  const db = createClient();
  const { error } = await db.from('messages').insert(
    msgs.map(m => ({
      user_id: userId,
      message_date: todayStr(),
      role: m.role,
      text: m.text,
    }))
  );
  if (error) console.error('[tempo] dbAppendMessages failed:', error.message);
}

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  userId: string | null;
  initialized: boolean;

  screen: Screen;
  profile: Profile;
  goals: Goal[];
  entries: Entry[];
  messages: Message[];
  nextId: number;

  // onboarding wizard
  obStep: ObStep;
  user: { name: string; email: string };
  tracking: Tracking;
  sex: Sex;
  activity: Activity;
  pace: Pace;
  age: number;
  weightKg: number;
  heightCm: number;
  targetWeightKg: number;

  // selectors
  activeGoal: () => Goal;
  totals: () => { eaten: number; burned: number; net: number; protein: number };

  // actions
  initFromSupabase: (user: User) => Promise<void>;
  setScreen: (s: Screen) => void;
  setObStep: (s: ObStep) => void;
  obNext: () => void;
  obBack: () => void;
  toggleTrack: (key: keyof Tracking) => void;
  setSex: (v: Sex) => void;
  setActivity: (v: Activity) => void;
  setPace: (v: Pace) => void;
  setBody: (patch: Partial<Pick<State, 'age' | 'weightKg' | 'heightCm' | 'targetWeightKg'>>) => void;
  applyComputedGoals: () => void;
  editGoal: (patch: Partial<Goal>) => void;
  setProfile: (patch: Partial<Profile>) => void;

  addEntries: (entries: Array<Omit<Entry, 'id' | 'time'>>, time?: string) => void;
  updateEntry: (id: number, patch: Partial<Entry>) => void;
  removeEntry: (id: number) => void;
  pushMessage: (m: Message) => void;

}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<State>((set, get) => ({
  userId: null,
  initialized: false,

  screen: 'onboarding',
  profile: { name: 'Friend', goalType: 'lose', water: 2.5, steps: 10000 },
  goals: DEFAULT_GOALS,
  entries: [],
  messages: DEFAULT_MESSAGES,
  nextId: 1,

  obStep: 'track',
  user: { name: '', email: '' },
  tracking: { weightLoss: true, calories: true, water: true, steps: true },
  sex: 'female',
  activity: 'moderate',
  pace: 'steady',
  age: 29,
  weightKg: 68,
  heightCm: 168,
  targetWeightKg: 63,

  activeGoal: () => {
    const s = get();
    return s.goals.find((g) => g.type === s.profile.goalType) ?? s.goals[0];
  },
  totals: () => {
    const { entries } = get();
    const food = entries.filter((e) => e.type === 'food');
    const eaten = food.reduce((x, e) => x + e.kcal, 0);
    const burned = entries.filter((e) => e.type === 'activity').reduce((x, e) => x + e.kcal, 0);
    return { eaten, burned, net: eaten - burned, protein: food.reduce((x, e) => x + (e.protein || 0), 0) };
  },

  initFromSupabase: async (user: User) => {
    try {
      const db = createClient();
      const { data: profileData } = await db
        .from('profiles').select('*').eq('id', user.id).single();

      if (!profileData) {
        // First-time user: pre-fill name from Google and start onboarding at step 2
        const googleName =
          (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined) ||
          'Friend';
        set({
          userId: user.id,
          initialized: true,
          screen: 'onboarding',
          obStep: 'track',
          user: { name: googleName, email: user.email ?? '' },
          profile: { ...get().profile, name: googleName },
        });
        return;
      }

      const date = todayStr();
      const [goalsRes, entriesRes, messagesRes] = await Promise.all([
        db.from('goals').select('*').eq('user_id', user.id),
        db.from('entries').select('*').eq('user_id', user.id).eq('entry_date', date),
        db.from('messages').select('*').eq('user_id', user.id).eq('message_date', date).order('pk'),
      ]);

      const profile: Profile = {
        name: profileData.name,
        goalType: profileData.goal_type,
        water: profileData.water,
        steps: profileData.steps,
      };

      const goals: Goal[] = goalsRes.data?.length
        ? goalsRes.data.map((g) => ({
            type: g.type,
            title: g.title,
            desc: g.desc,
            target: g.target,
            proteinTarget: g.protein_target,
            carbTarget: g.carb_target,
            fatTarget: g.fat_target,
          }))
        : DEFAULT_GOALS;

      const entries: Entry[] = (entriesRes.data ?? []).map((e) => ({
        id: e.local_id,
        time: e.time,
        type: e.type,
        name: e.name,
        kcal: e.kcal,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
        durationMin: e.duration_min,
        source: e.source as Source,
      }));

      const messages: Message[] = messagesRes.data?.length
        ? messagesRes.data.map((m) => ({ role: m.role as Message['role'], text: m.text }))
        : DEFAULT_MESSAGES;

      const nextId = entries.length > 0
        ? Math.max(...entries.map((e) => e.id)) + 1
        : 1;

      set({
        userId: user.id,
        initialized: true,
        screen: 'today',
        profile,
        goals,
        entries,
        messages,
        nextId,
        sex: profileData.sex as Sex,
        activity: profileData.activity as Activity,
        pace: profileData.pace as Pace,
        age: profileData.age,
        weightKg: profileData.weight_kg,
        heightCm: profileData.height_cm,
        targetWeightKg: profileData.target_weight_kg,
        tracking: profileData.tracking as Tracking,
        user: { name: profileData.name, email: user.email ?? '' },
      });
    } catch (e) {
      console.error('initFromSupabase failed:', e);
      set({ initialized: true }); // unblock the UI
    }
  },

  setScreen: (screen) => {
    const s = get();
    // Persist profile + goals when finishing onboarding
    if (screen === 'today' && s.screen === 'onboarding' && s.userId) {
      void dbSaveProfile(s.userId, s);
      void dbSaveGoals(s.userId, s.goals);
    }
    set({ screen });
  },

  setObStep: (obStep) => set({ obStep }),
  obNext: () => {
    const i = ORDER.indexOf(get().obStep);
    const next = ORDER[Math.min(i + 1, ORDER.length - 1)];
    if (next === 'goals') get().applyComputedGoals();
    set({ obStep: next });
  },
  obBack: () => {
    const i = ORDER.indexOf(get().obStep);
    set({ obStep: ORDER[Math.max(i - 1, 0)] });
  },

  toggleTrack: (key) => set((s) => ({ tracking: { ...s.tracking, [key]: !s.tracking[key] } })),
  setSex: (sex) => set({ sex }),
  setActivity: (activity) => set({ activity }),
  setPace: (pace) => set({ pace }),
  setBody: (patch) => set(patch as Partial<State>),

  applyComputedGoals: () =>
    set((s) => {
      const c = computeGoals({
        sex: s.sex, activity: s.activity, age: s.age,
        weightKg: s.weightKg, heightCm: s.heightCm, pace: s.pace, tracking: s.tracking,
      });
      const goals = s.goals.map((g) =>
        g.type === c.goalType
          ? { ...g, title: c.title, target: c.target, proteinTarget: c.proteinTarget, carbTarget: c.carbTarget, fatTarget: c.fatTarget }
          : g,
      );
      return { goals, profile: { ...s.profile, goalType: c.goalType, water: c.water, steps: c.steps } };
    }),

  editGoal: (patch) =>
    set((s) => {
      const goals = s.goals.map((g) => (g.type === s.profile.goalType ? { ...g, ...patch } : g));
      if (s.userId && s.initialized) void dbSaveGoals(s.userId, goals);
      return { goals };
    }),

  setProfile: (patch) =>
    set((s) => {
      const profile = { ...s.profile, ...patch };
      if (s.userId && s.initialized) void dbSaveProfile(s.userId, { ...s, profile });
      return { profile };
    }),

  addEntries: (entries, time = hhmm()) =>
    set((s) => {
      let id = s.nextId;
      const mapped: Entry[] = entries.map((e) => ({ ...e, id: id++, time }));
      const newEntries = [...s.entries, ...mapped];
      if (s.userId && s.initialized) void dbReplaceEntries(s.userId, newEntries);
      return { entries: newEntries, nextId: id };
    }),

  updateEntry: (id, patch) =>
    set((s) => {
      const entries = s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
      if (s.userId && s.initialized) void dbReplaceEntries(s.userId, entries);
      return { entries };
    }),

  removeEntry: (id) =>
    set((s) => {
      const entries = s.entries.filter((e) => e.id !== id);
      if (s.userId && s.initialized) void dbReplaceEntries(s.userId, entries);
      return { entries };
    }),

  pushMessage: (m) =>
    set((s) => {
      if (s.userId && s.initialized) void dbAppendMessages(s.userId, [m]);
      return { messages: [...s.messages, m] };
    }),

}));
