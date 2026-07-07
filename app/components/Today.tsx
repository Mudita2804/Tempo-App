'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Entry } from '@/lib/types';
import { SourceBadge } from './SourceBadge';

interface Props {
  onSelectEntry: (id: number) => void;
}

const CIRCUMFERENCE = 2 * Math.PI * 66; // ≈ 414.69

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

function clampPct(v: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((v / target) * 100)));
}

// ─── Log row with hover state ─────────────────────────────────────────────────

function LogRow({ entry, onSelect }: { entry: Entry; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  const removeEntry = useStore(s => s.removeEntry);
  const isActivity = entry.type === 'activity';

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    removeEntry(entry.id);
  }

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '11px 6px', borderBottom: '1px solid #efe9e0',
        cursor: 'pointer', borderRadius: 8,
        background: hovered ? '#fff' : 'transparent',
        transition: 'background .12s',
      }}
    >
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
        color: '#aaa297', width: 46, flexShrink: 0,
      }}>
        {entry.time}
      </span>
      <span style={{
        width: 9, height: 9, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
        background: isActivity ? '#3f9d5f' : '#d8d1c6',
      }} />
      <span style={{ flex: 1, fontSize: 14.5, color: '#211e1a' }}>
        {entry.name}
        {entry.durationMin
          ? <span style={{ color: '#8a8478' }}> · {entry.durationMin} min</span>
          : null}
      </span>
      <SourceBadge source={entry.source} />
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 500,
        color: isActivity ? '#3f9d5f' : '#6b655c',
        width: 52, textAlign: 'right', flexShrink: 0,
      }}>
        {isActivity ? '−' : '+'}{fmt(entry.kcal)}
      </span>
      {/* Quick-delete — visible on hover, stops propagation so it doesn't open SlideOver */}
      <div
        onClick={handleDelete}
        style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0, transition: 'opacity .12s',
          background: '#fbeae3', cursor: 'pointer',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c0492f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Today({ onSelectEntry }: Props) {
  const profile    = useStore(s => s.profile);
  const entries    = useStore(s => s.entries);
  const totals     = useStore(s => s.totals);
  const activeGoal = useStore(s => s.activeGoal);

  const t    = totals();
  const goal = activeGoal();

  const net       = t.net;
  const target    = goal.target;
  const remaining = target - net;

  // Ring
  const frac       = Math.max(0, Math.min(1, net / Math.max(1, target)));
  const ringOffset = Math.round(CIRCUMFERENCE * (1 - frac));

  // Macro totals (carbs + fat not in totals(), compute from entries)
  const foodEntries = entries.filter(e => e.type === 'food');
  const carbG = foodEntries.reduce((x, e) => x + (e.carbs || 0), 0);
  const fatG  = foodEntries.reduce((x, e) => x + (e.fat  || 0), 0);

  // Greeting
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr  = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const sorted = [...entries].sort((a, b) => (a.time < b.time ? -1 : 1));

  const overBudget = remaining < 0;

  return (
    <div style={{ flex: 1, padding: '30px 32px', overflowY: 'auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-end', marginBottom: 22,
      }}>
        <div>
          <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {greeting}, {profile.name}
          </div>
          <div style={{ fontSize: 14, color: '#8a8478', marginTop: 2 }}>{dateStr}</div>
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          padding: '6px 12px', borderRadius: 20, fontWeight: 500,
          background: overBudget ? '#fbeae3' : '#e8f3ec',
          color:      overBudget ? '#c0492f' : '#3f9d5f',
        }}>
          {overBudget ? 'over budget' : 'on track'}
        </div>
      </div>

      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', border: '1px solid #ece6dc', borderRadius: 18,
        padding: 26, display: 'flex', gap: 30, alignItems: 'center', marginBottom: 18,
        boxShadow: '0 1px 3px rgba(0,0,0,.08)',
      }}>
        {/* Ring */}
        <div style={{ position: 'relative', flexShrink: 0, width: 160, height: 160 }}>
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="66" fill="none" stroke="#ece6dc" strokeWidth="13" />
            <circle
              cx="80" cy="80" r="66" fill="none" stroke="#3f9d5f" strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 80 80)"
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmt(net)}</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, color: '#8a8478', letterSpacing: '0.04em',
            }}>NET KCAL</div>
          </div>
        </div>

        {/* Right of ring */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: '#6b655c', marginBottom: 14, lineHeight: 1.5 }}>
            You&apos;ve netted{' '}
            <strong style={{ color: '#211e1a' }}>{fmt(net)}</strong> of your{' '}
            <strong style={{ color: '#211e1a' }}>{fmt(target)}</strong> goal —{' '}
            <strong style={{ color: overBudget ? '#c0492f' : '#3f9d5f' }}>
              {overBudget ? `${fmt(-remaining)} kcal over` : `${fmt(remaining)} kcal left`}
            </strong>.
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {(
              [
                { label: 'EATEN',   value: fmt(t.eaten),         unit: '' },
                { label: 'BURNED',  value: fmt(t.burned),        unit: '' },
                { label: 'PROTEIN', value: String(t.protein),    unit: 'g' },
              ] as Array<{ label: string; value: string; unit: string }>
            ).map(({ label, value, unit }, i) => (
              <div key={label} style={i > 0 ? { borderLeft: '1px solid #ece6dc', paddingLeft: 24 } : {}}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11, color: '#8a8478', letterSpacing: '0.04em',
                }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {value}
                  {unit && <span style={{ fontSize: 13, color: '#8a8478', fontWeight: 500 }}>{unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Macro bars ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {([
          { label: 'Protein', val: t.protein,    max: goal.proteinTarget, color: '#3f9d5f' },
          { label: 'Carbs',   val: carbG,         max: goal.carbTarget,    color: '#c9b48a' },
          { label: 'Fat',     val: fatG,           max: goal.fatTarget,     color: '#d99a6c' },
        ] as const).map(({ label, val, max, color }) => (
          <div key={label} style={{
            flex: 1, background: '#fff', border: '1px solid #ece6dc',
            borderRadius: 14, padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,.08)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 13, marginBottom: 9,
            }}>
              <span style={{ fontWeight: 600, color: '#211e1a' }}>{label}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#6b655c' }}>
                {val} / {max}g
              </span>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: '#ece6dc', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, background: color,
                width: `${clampPct(val, max)}%`,
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Today's log ────────────────────────────────────────────────────── */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
        letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a8478', marginBottom: 6,
      }}>Today&apos;s log</div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sorted.length === 0 ? (
          <div style={{ fontSize: 14, color: '#aaa297', padding: '16px 6px' }}>
            No entries yet — tell the coach what you ate or did.
          </div>
        ) : sorted.map(entry => (
          <LogRow key={entry.id} entry={entry} onSelect={() => onSelectEntry(entry.id)} />
        ))}
      </div>
    </div>
  );
}
