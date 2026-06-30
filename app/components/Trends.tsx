'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';

type DayData = { eaten: number; burned: number; net: number };
type HistoryMap = Record<string, DayData>; // key: 'YYYY-MM-DD'

function fmt(n: number) { return Math.round(n).toLocaleString(); }

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const todayStr = () => new Date().toISOString().split('T')[0];

export function Trends() {
  const userId  = useStore(s => s.userId);
  const totals  = useStore(s => s.totals);
  const goals   = useStore(s => s.goals);
  const profile = useStore(s => s.profile);

  const goal = goals.find(g => g.type === profile.goalType) ?? goals[0];

  const [history, setHistory] = useState<HistoryMap>({});
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const db = createClient();
    db.from('entries')
      .select('entry_date, type, kcal')
      .eq('user_id', userId)
      .then(({ data }) => {
        const map: HistoryMap = {};
        for (const row of data ?? []) {
          if (!map[row.entry_date]) map[row.entry_date] = { eaten: 0, burned: 0, net: 0 };
          if (row.type === 'food') map[row.entry_date].eaten += row.kcal;
          else                     map[row.entry_date].burned += row.kcal;
        }
        for (const key of Object.keys(map)) {
          map[key].net = map[key].eaten - map[key].burned;
        }
        setHistory(map);
        setLoading(false);
      });
  }, [userId]);

  // Merge live store totals for today
  const t = totals();
  const today = todayStr();
  const live: HistoryMap = {
    ...history,
    ...(t.eaten > 0 || t.burned > 0
      ? { [today]: { eaten: t.eaten, burned: t.burned, net: t.net } }
      : {}),
  };

  // Month grid
  const { year, month: m } = view;
  const firstDow    = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const isCurrentMonth = year === now.getFullYear() && m === now.getMonth();

  // Stats for the viewed month
  const monthEntries = Object.entries(live).filter(([k]) => {
    const d = new Date(k + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() === m && k <= today;
  });
  const daysLogged    = monthEntries.length;
  const daysOnTarget  = monthEntries.filter(([, d]) => d.net <= goal.target).length;
  const avgNet        = daysLogged > 0
    ? Math.round(monthEntries.reduce((s, [, d]) => s + d.net, 0) / daysLogged)
    : 0;

  const isCurrentYear = year === now.getFullYear();

  function prevMonth() {
    setView(v => {
      const d = new Date(v.year, v.month - 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    setView(v => {
      const d = new Date(v.year, v.month + 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }
  function prevYear() {
    setView(v => ({ year: v.year - 1, month: v.month }));
  }
  function nextYear() {
    if (isCurrentYear) return;
    setView(v => {
      const newYear = v.year + 1;
      const clampedMonth = newYear === now.getFullYear()
        ? Math.min(v.month, now.getMonth())
        : v.month;
      return { year: newYear, month: clampedMonth };
    });
  }

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
      <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 2 }}>
        Trends
      </div>
      <div style={{ fontSize: 14, color: '#8a8478', marginBottom: 26 }}>
        {MONTHS[m]} {year}
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
        <StatCard label="AVG NET"        value={daysLogged ? fmt(avgNet) : '—'} />
        <StatCard label="DAYS ON TARGET" value={String(daysOnTarget)} sub={` / ${daysLogged}`} />
        <StatCard label="DAYS LOGGED"    value={String(daysLogged)} valColor="#3f9d5f" />
        <StatCard label="GOAL"           value={fmt(goal.target)} sub=" kcal" />
      </div>

      {/* ── Calendar ───────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', border: '1px solid #ece6dc',
        borderRadius: 16, padding: 24,
      }}>
        {/* Year nav */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 10,
        }}>
          <NavBtn onClick={prevYear}>‹</NavBtn>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#8a8478', minWidth: 40, textAlign: 'center' }}>{year}</div>
          <NavBtn onClick={nextYear} disabled={isCurrentYear}>›</NavBtn>
        </div>

        {/* Month nav */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
        }}>
          <NavBtn onClick={prevMonth}>‹</NavBtn>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{MONTHS[m]}</div>
          <NavBtn onClick={nextMonth} disabled={isCurrentMonth}>›</NavBtn>
        </div>

        {/* Day-of-week headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4,
        }}>
          {DAY_HEADERS.map(d => (
            <div key={d} style={{
              textAlign: 'center',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, color: '#aaa297', padding: '4px 0',
            }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day     = i + 1;
            const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const data    = live[dateStr];
            const isToday = dateStr === today;
            const isFuture = dateStr > today;

            const dotColor = data && !isFuture
              ? (data.net <= goal.target ? '#3f9d5f' : '#d99a6c')
              : null;

            return (
              <div key={day} style={{
                borderRadius: 10,
                padding: '8px 4px',
                background: isToday ? '#e8f3ec' : '#f7f4ef',
                border: isToday ? '1.5px solid #3f9d5f' : '1.5px solid transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                minHeight: 60,
              }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? '#3f9d5f' : isFuture ? '#ccc' : '#211e1a',
                }}>{day}</div>

                {dotColor && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
                )}

                {data && !isFuture && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9, color: '#8a8478', textAlign: 'center',
                    lineHeight: 1.3,
                  }}>{fmt(data.net)}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, marginTop: 16, justifyContent: 'flex-end' }}>
          {[
            { color: '#3f9d5f', label: 'On target' },
            { color: '#d99a6c', label: 'Over target' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 12, color: '#8a8478' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ fontSize: 13, color: '#aaa297', textAlign: 'center', marginTop: 20 }}>
          Loading history…
        </div>
      )}
    </div>
  );
}

// ─── Nav button ───────────────────────────────────────────────────────────────

function NavBtn({ onClick, disabled, children }: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'none', border: '1px solid #ece6dc', borderRadius: 8,
        width: 32, height: 32, cursor: disabled ? 'default' : 'pointer',
        fontSize: 18, color: disabled ? '#ccc' : '#6b655c',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'color .12s',
      }}
    >{children}</button>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, valColor = '#211e1a', subColor = '#8a8478',
}: {
  label: string; value: string; sub?: string; valColor?: string; subColor?: string;
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
        {sub && <span style={{ fontSize: 14, fontWeight: 500, color: subColor }}>{sub}</span>}
      </div>
    </div>
  );
}
