'use client';

import { useStore } from '@/lib/store';

// Static historical data — the last bar is today's live net
const HIST: Array<[string, number]> = [
  ['Wed', 1720], ['Thu', 1540], ['Fri', 1880],
  ['Sat', 1610], ['Sun', 1750], ['Mon', 1490],
];

function fmt(n: number) { return Math.round(n).toLocaleString(); }

export function Trends() {
  const totals  = useStore(s => s.totals);
  const goals   = useStore(s => s.goals);
  const profile = useStore(s => s.profile);

  const t      = totals();
  const goal   = goals.find(g => g.type === profile.goalType) ?? goals[0];
  const todayNet = t.net;

  const allNets  = HIST.map(([, n]) => n).concat([todayNet]);
  const maxN     = Math.max(2200, ...allNets);
  const goalPct  = Math.round(goal.target / maxN * 100);

  const bars = ([...HIST, ['Tue', todayNet]] as Array<[string, number]>).map(([label, n]) => ({
    label, net: fmt(n),
    h:     Math.max(4, Math.round(n / maxN * 100)),
    color: n <= goal.target ? '#3f9d5f' : '#d99a6c',
  }));

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
      <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 2 }}>
        Trends
      </div>
      <div style={{ fontSize: 14, color: '#8a8478', marginBottom: 26 }}>Last 7 days</div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
        <StatCard label="AVG NET"        value="1,664" />
        <StatCard label="DAYS ON TARGET" value="5" sub="/ 7" />
        <StatCard label="STREAK"         value="12" sub=" days logged" valColor="#3f9d5f" />
        <StatCard label="WEIGHT"         value="68.2" sub=" −0.4" subColor="#3f9d5f" />
      </div>

      {/* ── Bar chart ──────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', border: '1px solid #ece6dc',
        borderRadius: 16, padding: 24, marginBottom: 20,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 20,
        }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Net energy vs goal</div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#8a8478',
          }}>goal {fmt(goal.target)}</div>
        </div>

        {/* Bars */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 18, height: 200,
          position: 'relative', borderBottom: '1px solid #ece6dc',
        }}>
          {/* Goal dashed line */}
          <div style={{
            position: 'absolute', left: 0, right: 0,
            borderTop: '1px dashed #d9d1c4',
            bottom: `${goalPct}%`,
            pointerEvents: 'none',
          }} />

          {bars.map(({ label, net, h, color }) => (
            <div key={label} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end',
              height: '100%', gap: 8,
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8a8478',
              }}>{net}</div>
              <div style={{
                width: '100%', maxWidth: 44, borderRadius: '7px 7px 0 0',
                background: color, height: `${h}%`,
              }} />
            </div>
          ))}
        </div>

        {/* Day labels */}
        <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
          {bars.map(({ label }) => (
            <div key={label} style={{
              flex: 1, textAlign: 'center',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#aaa297',
            }}>{label}</div>
          ))}
        </div>
      </div>

      {/* ── Weight trend + Avg macros ───────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Weight trend */}
        <div style={{
          flex: 1, background: '#fff', border: '1px solid #ece6dc', borderRadius: 16, padding: 24,
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Weight trend</div>
          <svg width="100%" height="120" viewBox="0 0 360 120" preserveAspectRatio="none">
            <polyline
              points="0,28 60,34 120,30 180,46 240,52 300,60 360,70"
              fill="none" stroke="#3f9d5f" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            />
            <circle cx="360" cy="70" r="4" fill="#3f9d5f" />
          </svg>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 6,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#aaa297',
          }}>
            <span>4 wks ago</span>
            <span>now</span>
          </div>
        </div>

        {/* Avg macros */}
        <div style={{
          flex: 1, background: '#fff', border: '1px solid #ece6dc', borderRadius: 16, padding: 24,
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Avg macros / day</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {([
              { label: 'Protein', val: '104g', pct: 87, color: '#3f9d5f' },
              { label: 'Carbs',   val: '186g', pct: 93, color: '#c9b48a' },
              { label: 'Fat',     val: '54g',  pct: 90, color: '#d99a6c' },
            ] as const).map(({ label, val, pct, color }) => (
              <div key={label}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6,
                }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", color: '#8a8478',
                  }}>{val}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: '#ece6dc' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card atom ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, valColor = '#211e1a', subColor = '#8a8478',
}: {
  label: string;
  value: string;
  sub?: string;
  valColor?: string;
  subColor?: string;
}) {
  return (
    <div style={{
      flex: 1, background: '#fff', border: '1px solid #ece6dc', borderRadius: 14, padding: 18,
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        color: '#8a8478', letterSpacing: '0.04em', marginBottom: 6,
      }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: valColor }}>
        {value}
        {sub && (
          <span style={{ fontSize: 14, fontWeight: 500, color: subColor }}>{sub}</span>
        )}
      </div>
    </div>
  );
}
