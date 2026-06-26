import type { Activity, Pace, Sex, Tracking } from './types';

export interface ComputeInput {
  sex: Sex;
  activity: Activity;
  age: number;
  weightKg: number;
  heightCm: number;
  pace: Pace;
  tracking: Tracking;
}

export interface ComputedGoals {
  goalType: 'lose' | 'maintain';
  title: string;
  target: number;        // daily net kcal
  proteinTarget: number; // g
  carbTarget: number;    // g
  fatTarget: number;     // g
  water: number;         // L / day
  steps: number;         // steps / day
}

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very: 1.9,
};

const PACE_DEFICIT: Record<Pace, number> = {
  relaxed: 275,
  steady: 500,
  ambitious: 750,
};

const ACTIVITY_STEPS: Record<Activity, number> = {
  sedentary: 6000,
  light: 8000,
  moderate: 10000,
  active: 12000,
  very: 14000,
};

/**
 * Derive calorie + macro + water + step targets from body metrics and answers.
 * Mifflin-St Jeor BMR → TDEE → optional weight-loss deficit. All outputs are
 * intended as DEFAULTS the user can edit afterward.
 */
export function computeGoals(input: ComputeInput): ComputedGoals {
  const { sex, activity, age, weightKg, heightCm, pace, tracking } = input;

  const bmr =
    sex === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const tdee = bmr * (ACTIVITY_FACTOR[activity] ?? 1.55);

  let target = tdee;
  if (tracking.weightLoss) target -= PACE_DEFICIT[pace] ?? 500;
  target = Math.max(1200, Math.round(target / 10) * 10);

  const proteinTarget = Math.round(weightKg * 1.6);
  const fatTarget = Math.round((target * 0.25) / 9);
  const carbTarget = Math.max(
    0,
    Math.round((target - proteinTarget * 4 - fatTarget * 9) / 4),
  );

  const water = Math.round(weightKg * 0.035 * 10) / 10;
  const steps = ACTIVITY_STEPS[activity] ?? 10000;

  return {
    goalType: tracking.weightLoss ? 'lose' : 'maintain',
    title: tracking.weightLoss ? 'Weight loss' : 'Maintain',
    target,
    proteinTarget,
    carbTarget,
    fatTarget,
    water,
    steps,
  };
}
