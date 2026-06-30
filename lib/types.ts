// Core domain types for Tempo.

export type EntryType = 'food' | 'activity';
export type Source = 'voice' | 'text' | 'manual';

export interface Entry {
  id: number;
  time: string;            // 'HH:MM'
  type: EntryType;
  name: string;
  kcal: number;            // food: consumed; activity: burned (positive)
  protein: number;         // grams (0 for activity)
  carbs: number;
  fat: number;
  durationMin: number | null;
  source: Source;
}

export interface Message {
  role: 'coach' | 'user';
  text: string;
}

export type GoalType = 'lose' | 'maintain' | 'gain';

export interface Goal {
  type: GoalType;
  title: string;           // editable label, e.g. "Weight loss"
  desc: string;
  target: number;          // daily net kcal
  proteinTarget: number;   // grams
  carbTarget: number;
  fatTarget: number;
}

export interface Profile {
  name: string;
  goalType: GoalType;
  water: number;           // L / day
  steps: number;           // steps / day
}

export interface Tracking {
  weightLoss: boolean;
  calories: boolean;
  water: boolean;
  steps: boolean;
}

export type Sex = 'female' | 'male';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very';
export type Pace = 'relaxed' | 'steady' | 'ambitious';
export type ObStep = 'track' | 'questions' | 'body' | 'goals';

// ---- LLM contract (mirrors /api/coach) ----
export interface CoachEntry {
  type: EntryType;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  durationMin: number | null;
}

export interface CoachResponse {
  needsClarification: boolean;
  question: string;
  entries: CoachEntry[];
  reply: string;
}

export interface CoachContext {
  goalTitle: string;
  target: number;
  goalType: GoalType;
  eaten: number;
  burned: number;
  net: number;
  protein: number;
  proteinTarget: number;
  history: string;         // recent transcript, newest last
}
