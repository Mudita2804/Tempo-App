'use client';

import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';

function parseNum(s: string) {
  return Math.max(0, parseInt(s.replace(/[^0-9]/g, ''), 10) || 0);
}

const CALORIE_FIELDS = [
  { label: 'Daily net · kcal', key: 'target'        },
  { label: 'Protein · g',      key: 'proteinTarget' },
  { label: 'Carbs · g',        key: 'carbTarget'    },
  { label: 'Fat · g',          key: 'fatTarget'     },
] as const;

export function Settings() {
  const goals            = useStore(s => s.goals);
  const profile          = useStore(s => s.profile);
  const editGoal         = useStore(s => s.editGoal);
  const setProfile       = useStore(s => s.setProfile);
  const goal = goals.find(g => g.type === profile.goalType) ?? goals[0];
  const fmt  = (n: number) => Math.round(n).toLocaleString();

  function chipStyle(sel: boolean): React.CSSProperties {
    return {
      cursor: 'pointer', padding: '13px 15px', borderRadius: 11,
      flex: 1, textAlign: 'center', fontSize: 14.5, fontWeight: 600,
      border: sel ? '2px solid #3f9d5f' : '1px solid #ece6dc',
      background: sel ? '#f1f8f3' : '#fff',
      color: sel ? '#256b3f' : '#3a3530',
    };
  }

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
      <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 24 }}>
        Settings
      </div>

      <div style={{ maxWidth: 640 }}>

        {/* ── Your goal card ──────────────────────────────────────────────── */}
        <div style={{
          background: '#fff', border: '1px solid #ece6dc',
          borderRadius: 16, padding: 24, marginBottom: 20,
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Your goal</div>

          {/* Summary row */}
          <div style={{ display: 'flex', gap: 24 }}>
            {[
              { key: 'FOCUS',     value: goal.title                   },
              { key: 'DAILY NET', value: `${fmt(goal.target)} kcal`   },
              { key: 'PROTEIN',   value: `${goal.proteinTarget}g`      },
            ].map(({ key, value }, i) => (
              <div key={key} style={i > 0 ? { borderLeft: '1px solid #ece6dc', paddingLeft: 24 } : {}}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                  color: '#8a8478', marginBottom: 4,
                }}>{key}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Goal type chips (labels reflect any user edits) */}
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            {goals.map(g => (
              <div
                key={g.type}
                onClick={() => setProfile({ goalType: g.type })}
                style={chipStyle(profile.goalType === g.type)}
              >{g.title}</div>
            ))}
          </div>

          {/* Goal name + macro editor */}
          <div style={{
            background: '#f7f4ef', border: '1px solid #ece6dc',
            borderRadius: 12, padding: '14px 16px', marginTop: 16,
          }}>
            <div style={{ fontSize: 11.5, color: '#8a8478', marginBottom: 7 }}>Goal name</div>
            <input
              value={goal.title}
              onChange={e => editGoal({ title: e.target.value })}
              onFocus={ev => { ev.currentTarget.style.borderBottomColor = '#3f9d5f'; }}
              onBlur={ev  => { ev.currentTarget.style.borderBottomColor = '#ece6dc'; }}
              style={{
                fontSize: 15, fontWeight: 600, color: '#211e1a',
                background: 'transparent', border: 'none',
                borderBottom: '2px solid #ece6dc', outline: 'none',
                width: '100%', fontFamily: 'inherit', padding: '0 0 4px', marginBottom: 14,
              }}
            />

            <div style={{ display: 'flex', gap: 14 }}>
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
        </div>

        {/* ── Connected sources card ──────────────────────────────────────── */}
        <div style={{
          background: '#fff', border: '1px solid #ece6dc', borderRadius: 16, padding: 24,
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Connected sources</div>
          <div style={{ fontSize: 13.5, color: '#8a8478', marginBottom: 18 }}>
            Sync workouts for accurate calorie burn instead of estimates.
          </div>

          {/* Apple Health — coming soon */}
          <IntegrationSoon icon="Ah" name="Apple Health" sub="Steps, weight &amp; heart rate" />

          {/* Garmin — coming soon */}
          <IntegrationSoon icon="Ga" name="Garmin" sub="Workouts &amp; recovery" />
        </div>

        {/* ── Account card ────────────────────────────────────────────────── */}
        <div style={{
          background: '#fff', border: '1px solid #ece6dc',
          borderRadius: 16, padding: 24, marginTop: 20,
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Account</div>
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fbeae3'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f7f4ef'; }}
            style={{
              background: '#f7f4ef', border: '1px solid #ece6dc',
              color: '#b3502f', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
              transition: 'background .15s',
            }}
          >
            Sign out
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Coming-soon integration row ──────────────────────────────────────────────

function IntegrationSoon({ icon, name, sub }: { icon: string; name: string; sub: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', borderRadius: 12, border: '1px solid #efe9e0',
      marginTop: 10, opacity: 0.55,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10, background: '#e9e3d9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#8a8478', fontWeight: 800, fontSize: 14, flexShrink: 0,
        }}>{icon}</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{name}</div>
          <div
            style={{ fontSize: 12.5, color: '#8a8478' }}
            dangerouslySetInnerHTML={{ __html: sub }}
          />
        </div>
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#aaa297',
      }}>soon</div>
    </div>
  );
}
