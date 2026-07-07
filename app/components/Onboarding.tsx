'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import type { Activity, Pace, Sex } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const OB_ORDER: string[] = ['track', 'questions', 'body', 'goals'];

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function parseNum(s: string): number {
  return Math.max(0, parseInt(s.replace(/[^0-9]/g, ''), 10) || 0);
}

function parseDecimal(s: string): number {
  const v = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(v) ? 0 : Math.max(0, v);
}

// ─── Shared text styles ───────────────────────────────────────────────────────

const h1Style: React.CSSProperties = {
  fontSize: 29, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 8px',
};

const subStyle: React.CSSProperties = {
  fontSize: 15.5, lineHeight: 1.55, color: '#6b655c', margin: '0 0 24px',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#6b655c', marginBottom: 9,
};

// ─── Shared button atoms ──────────────────────────────────────────────────────

function BtnPrimary({
  children, onClick, full = false, padding,
}: {
  children: React.ReactNode;
  onClick: () => void;
  full?: boolean;
  padding?: number | string;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        ...(full ? { width: '100%' } : { flex: 1 }),
        border: 'none', cursor: 'pointer',
        background: h ? '#368a53' : '#3f9d5f',
        color: '#fff', fontFamily: 'inherit', fontSize: 16, fontWeight: 600,
        padding: padding ?? 14, borderRadius: 13,
        boxShadow: '0 4px 16px rgba(63,157,95,.35)',
      }}
    >{children}</button>
  );
}

function BtnSecondary({
  children, onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        border: '1px solid #ece6dc', cursor: 'pointer',
        background: h ? '#f3efe8' : '#fff',
        color: '#6b655c', fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
        padding: '14px 22px', borderRadius: 13,
      }}
    >{children}</button>
  );
}

function NavRow({
  onBack, onNext, nextLabel = 'Continue →', mt,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  mt?: number;
}) {
  return (
    <div style={{ display: 'flex', gap: 12, ...(mt !== undefined ? { marginTop: mt } : {}) }}>
      <BtnSecondary onClick={onBack}>Back</BtnSecondary>
      <BtnPrimary onClick={onNext}>{nextLabel}</BtnPrimary>
    </div>
  );
}

// ─── Underline input (body + goals steps) ─────────────────────────────────────

function UnderlineInput({
  value, onChange, inputMode = 'numeric', width = '100%', textAlign = 'left',
}: {
  value: number | string;
  onChange: (v: string) => void;
  inputMode?: 'numeric' | 'decimal';
  width?: string | number;
  textAlign?: 'left' | 'right';
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      inputMode={inputMode}
      onFocus={e => { e.currentTarget.style.borderBottomColor = '#3f9d5f'; }}
      onBlur={e  => { e.currentTarget.style.borderBottomColor = '#ece6dc'; }}
      style={{
        fontSize: 22, fontWeight: 700, color: '#211e1a', background: 'transparent',
        border: 'none', borderBottom: '2px solid #ece6dc', outline: 'none',
        width, textAlign, fontFamily: 'inherit', padding: '0 0 3px',
      }}
    />
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function Onboarding() {
  const obStep = useStore(s => s.obStep);

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: '#f7f4ef', padding: '48px 40px', overflowY: 'auto',
    }}>
      <div style={{ width: 560, maxWidth: '100%' }}>
        <OBHeader obStep={obStep} />
        {obStep === 'track'     && <StepTrack />}
        {obStep === 'questions' && <StepQuestions />}
        {obStep === 'body'      && <StepBody />}
        {obStep === 'goals'     && <StepGoals />}
      </div>
    </div>
  );
}

// ─── Header: brand + progress pills ──────────────────────────────────────────

function OBHeader({ obStep }: { obStep: string }) {
  const idx = OB_ORDER.indexOf(obStep);

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 30,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: '#3f9d5f',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 18,
        }}>T</div>
        <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em' }}>Tempo</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {OB_ORDER.map((_, i) => (
          <div key={i} style={{
            height: 7, borderRadius: 4, flexShrink: 0,
            width: i === idx ? 22 : 7,
            background: i <= idx ? '#3f9d5f' : '#dcd5ca',
            transition: 'all .2s',
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Step 1: Track ────────────────────────────────────────────────────────────

const TRACK_DEFS = [
  { key: 'weightLoss' as const, label: 'Weight loss',    desc: 'Reach a target weight',       comingSoon: false },
  { key: 'calories'   as const, label: 'Count calories', desc: 'Track energy in vs out',       comingSoon: false },
  { key: 'water'      as const, label: 'Water intake',   desc: 'Hit a daily hydration goal',   comingSoon: true  },
  { key: 'steps'      as const, label: 'Step count',     desc: 'Move more each day',           comingSoon: true  },
];

function StepTrack() {
  const tracking    = useStore(s => s.tracking);
  const toggleTrack = useStore(s => s.toggleTrack);
  const obNext      = useStore(s => s.obNext);

  async function handleBack() {
    await createClient().auth.signOut();
    window.location.href = '/login';
  }

  return (
    <>
      <h1 style={h1Style}>What do you want to track?</h1>
      <p style={subStyle}>
        Pick everything you&apos;d like Tempo to keep an eye on. You can change this later.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 28 }}>
        {TRACK_DEFS.map(({ key, label, desc, comingSoon }) => {
          const on = !comingSoon && tracking[key];
          return (
            <div
              key={key}
              onClick={() => { if (!comingSoon) toggleTrack(key); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                cursor: comingSoon ? 'default' : 'pointer',
                padding: '16px 18px', borderRadius: 14,
                border: on ? '2px solid #3f9d5f' : '2px solid #ece6dc',
                background: on ? '#f1f8f3' : comingSoon ? '#fafaf8' : '#fff',
                opacity: comingSoon ? 0.6 : 1,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#211e1a' }}>{label}</span>
                  {comingSoon && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                      color: '#8a8478', background: '#ece6dc',
                      padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase',
                    }}>Coming soon</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#8a8478', marginTop: 2 }}>{desc}</div>
              </div>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: on ? '#3f9d5f' : '#fff',
                border: on ? 'none' : '2px solid #d8d1c6',
                color: '#fff', fontSize: 13, fontWeight: 800,
              }}>
                {on ? '✓' : null}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <BtnSecondary onClick={handleBack}>Back</BtnSecondary>
        <BtnPrimary onClick={obNext}>Continue →</BtnPrimary>
      </div>
    </>
  );
}

// ─── Step 3: Questions ────────────────────────────────────────────────────────

const ACTIVITY_DEFS: Array<{ value: Activity; label: string; sub: string }> = [
  { value: 'sedentary', label: 'Sedentary',   sub: 'Little / no exercise'  },
  { value: 'light',     label: 'Light',        sub: '1–2 days a week'      },
  { value: 'moderate',  label: 'Moderate',     sub: '3–4 days a week'      },
  { value: 'active',    label: 'Active',       sub: '5–6 days a week'      },
  { value: 'very',      label: 'Very active',  sub: 'Daily / physical job' },
];

const PACE_DEFS: Array<{ value: Pace; label: string; sub: string }> = [
  { value: 'relaxed',   label: 'Relaxed',   sub: '≈ 0.25 kg / wk' },
  { value: 'steady',    label: 'Steady',    sub: '≈ 0.5 kg / wk'  },
  { value: 'ambitious', label: 'Ambitious', sub: '≈ 0.75 kg / wk' },
];

function StepQuestions() {
  const sex         = useStore(s => s.sex);
  const activity    = useStore(s => s.activity);
  const pace        = useStore(s => s.pace);
  const tracking    = useStore(s => s.tracking);
  const setSex      = useStore(s => s.setSex);
  const setActivity = useStore(s => s.setActivity);
  const setPace     = useStore(s => s.setPace);
  const obNext      = useStore(s => s.obNext);
  const obBack      = useStore(s => s.obBack);

  const showSex  = tracking.calories || tracking.weightLoss;
  const showPace = tracking.weightLoss;

  function chipBase(sel: boolean): React.CSSProperties {
    return {
      cursor: 'pointer', padding: '13px 15px', borderRadius: 11, flex: 1, textAlign: 'center',
      border: sel ? '2px solid #3f9d5f' : '1px solid #ece6dc',
      background: sel ? '#f1f8f3' : '#fff',
      fontSize: 14.5, fontWeight: 600,
      color: sel ? '#256b3f' : '#3a3530',
    };
  }

  return (
    <>
      <h1 style={h1Style}>A few quick questions</h1>
      <p style={subStyle}>
        These set accurate targets. Every number stays editable on the goals screen.
      </p>

      {/* Sex */}
      {showSex && (
        <>
          <div style={sectionLabelStyle}>Sex</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
            {(['female', 'male'] as Sex[]).map(v => (
              <div key={v} onClick={() => setSex(v)} style={chipBase(sex === v)}>
                {v === 'female' ? 'Female' : 'Male'}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Activity level */}
      <div style={sectionLabelStyle}>Activity level</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 22 }}>
        {ACTIVITY_DEFS.map(({ value, label, sub }) => {
          const sel = activity === value;
          return (
            <div
              key={value}
              onClick={() => setActivity(value)}
              style={{
                cursor: 'pointer', padding: '13px 16px', borderRadius: 11,
                border: sel ? '2px solid #3f9d5f' : '1px solid #ece6dc',
                background: sel ? '#f1f8f3' : '#fff',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 14.5, fontWeight: 600, color: sel ? '#256b3f' : '#211e1a' }}>
                {label}
              </span>
              <span style={{ fontSize: 12.5, color: '#8a8478' }}>{sub}</span>
            </div>
          );
        })}
      </div>

      {/* Weekly pace */}
      {showPace && (
        <>
          <div style={sectionLabelStyle}>Weekly pace</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
            {PACE_DEFS.map(({ value, label, sub }) => {
              const sel = pace === value;
              return (
                <div
                  key={value}
                  onClick={() => setPace(value)}
                  style={{
                    cursor: 'pointer', padding: '13px 12px', borderRadius: 11, flex: 1,
                    textAlign: 'center',
                    border: sel ? '2px solid #3f9d5f' : '1px solid #ece6dc',
                    background: sel ? '#f1f8f3' : '#fff',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: sel ? '#256b3f' : '#3a3530' }}>
                    {label}
                  </span>
                  <span style={{
                    display: 'block', fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11, color: '#8a8478', marginTop: 4,
                  }}>
                    {sub}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <BtnSecondary onClick={obBack}>Back</BtnSecondary>
        <BtnPrimary onClick={obNext}>Continue →</BtnPrimary>
      </div>
    </>
  );
}

// ─── Step 4: Body ─────────────────────────────────────────────────────────────

function StepBody() {
  const age            = useStore(s => s.age);
  const weightKg       = useStore(s => s.weightKg);
  const heightCm       = useStore(s => s.heightCm);
  const targetWeightKg = useStore(s => s.targetWeightKg);
  const tracking       = useStore(s => s.tracking);
  const setBody        = useStore(s => s.setBody);
  const obNext         = useStore(s => s.obNext);
  const obBack         = useStore(s => s.obBack);

  return (
    <>
      <h1 style={h1Style}>Tell me about you</h1>
      <p style={subStyle}>
        Used to estimate your energy needs. You can fine-tune the results next.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        {([
          { label: 'Age · years',  val: age,      key: 'age'      as const },
          { label: 'Weight · kg',  val: weightKg, key: 'weightKg' as const },
          { label: 'Height · cm',  val: heightCm, key: 'heightCm' as const },
        ] as Array<{ label: string; val: number; key: 'age' | 'weightKg' | 'heightCm' }>).map(({ label, val, key }) => (
          <div key={key} style={{
            flex: 1, background: '#fff', border: '1px solid #ece6dc',
            borderRadius: 13, padding: 14,
          }}>
            <div style={{ fontSize: 11.5, color: '#8a8478', marginBottom: 7 }}>{label}</div>
            <UnderlineInput
              value={val}
              onChange={v => setBody({ [key]: parseNum(v) })}
            />
          </div>
        ))}
      </div>

      {tracking.weightLoss && (
        <div style={{
          background: '#fff', border: '1px solid #ece6dc',
          borderRadius: 13, padding: 14, marginBottom: 26,
        }}>
          <div style={{ fontSize: 11.5, color: '#8a8478', marginBottom: 7 }}>Target weight · kg</div>
          <UnderlineInput
            value={targetWeightKg}
            onChange={v => setBody({ targetWeightKg: parseNum(v) })}
            width={140}
          />
        </div>
      )}

      <NavRow onBack={obBack} onNext={obNext} nextLabel="See my goals →" mt={12} />
    </>
  );
}

// ─── Step 5: Goals ────────────────────────────────────────────────────────────

const CALORIE_FIELDS = [
  { label: 'Daily net · kcal', key: 'target'        },
  { label: 'Protein · g',      key: 'proteinTarget' },
  { label: 'Carbs · g',        key: 'carbTarget'    },
  { label: 'Fat · g',          key: 'fatTarget'     },
] as const;

const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very: 1.9,
};

function StepGoals() {
  const goals           = useStore(s => s.goals);
  const profile         = useStore(s => s.profile);
  const tracking        = useStore(s => s.tracking);
  const pace            = useStore(s => s.pace);
  const sex             = useStore(s => s.sex);
  const activity        = useStore(s => s.activity);
  const age             = useStore(s => s.age);
  const weightKg        = useStore(s => s.weightKg);
  const heightCm        = useStore(s => s.heightCm);
  const targetWeightKg  = useStore(s => s.targetWeightKg);
  const editGoal        = useStore(s => s.editGoal);
  const setProfile      = useStore(s => s.setProfile);
  const setScreen       = useStore(s => s.setScreen);
  const obBack          = useStore(s => s.obBack);

  const goal = goals.find(g => g.type === profile.goalType) ?? goals[0];

  const showCalories = tracking.calories || tracking.weightLoss;

  // ── Focus card derivations ────────────────────────────────────────────────
  const goalType = profile.goalType;
  const weightDelta = Math.abs(weightKg - targetWeightKg);
  const deltaStr = weightDelta % 1 === 0 ? String(weightDelta) : weightDelta.toFixed(1);

  const targetLine =
    goalType === 'lose'     ? `Lose ${deltaStr} kg` :
    goalType === 'gain'     ? `Gain ${deltaStr} kg` :
                              `Maintain ${weightKg} kg`;

  // Timeline: weeks = (weightDelta × 7700) / (dailyDeficit × 7)
  // dailyDeficit = TDEE − goal.target (recalculates live when user edits kcal)
  const bmr = sex === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  const tdee = bmr * (ACTIVITY_FACTOR[activity] ?? 1.55);
  const dailyDeficit = tdee - goal.target;
  const showTimeline = goalType === 'lose' && weightDelta > 0 && dailyDeficit > 0;
  const weeks = showTimeline
    ? Math.round((weightDelta * 7700) / (dailyDeficit * 7))
    : 0;

  const headline = tracking.weightLoss
    ? `A net target of about ${fmt(goal.target)} kcal a day should move you toward your goal at a ${pace} pace. Everything below is editable.`
    : `Your maintenance net sits around ${fmt(goal.target)} kcal a day. Everything below is editable.`;

  return (
    <>
      <h1 style={h1Style}>Your goals</h1>
      <p style={{ fontSize: 15, lineHeight: 1.55, color: '#6b655c', margin: '0 0 22px' }}>
        {headline}
      </p>

      {/* ── Focus card ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#F1F8F3', border: '1px solid #B6DCC3',
        borderRadius: 16, padding: 22, marginBottom: 20,
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
          fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: '#256B3F', marginBottom: 8,
        }}>Your Focus</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#211e1a', letterSpacing: '-0.01em', marginBottom: showTimeline ? 6 : 0 }}>
          {targetLine}
        </div>
        {showTimeline && (
          <div style={{ fontSize: 14, color: '#3a3530' }}>
            ~{weeks} week{weeks !== 1 ? 's' : ''} at this pace
          </div>
        )}
      </div>

      {/* Calories & macros */}
      {showCalories && (
        <div style={{
          background: '#fff', border: '1px solid #ece6dc',
          borderRadius: 14, padding: 18, marginBottom: 14,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#211e1a', marginBottom: 14 }}>
            Calories &amp; macros
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {CALORIE_FIELDS.map(({ label, key }) => (
              <div key={key} style={{ flex: 1 }}>
                <div style={{ fontSize: 11.5, color: '#8a8478', marginBottom: 7 }}>{label}</div>
                <input
                  value={goal[key]}
                  onChange={e => editGoal({ [key]: parseNum(e.target.value) })}
                  inputMode="numeric"
                  onFocus={ev => { ev.currentTarget.style.borderBottomColor = '#3f9d5f'; }}
                  onBlur={ev  => { ev.currentTarget.style.borderBottomColor = '#ece6dc'; }}
                  style={{
                    fontSize: 19, fontWeight: 700, color: '#211e1a',
                    background: 'transparent', border: 'none',
                    borderBottom: '2px solid #ece6dc', outline: 'none',
                    width: '100%', fontFamily: 'inherit', padding: '0 0 3px',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
        <BtnSecondary onClick={obBack}>Back</BtnSecondary>
        <BtnPrimary onClick={() => setScreen('today')} padding={15}>
          Start tracking →
        </BtnPrimary>
      </div>
    </>
  );
}
