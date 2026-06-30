'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Entry } from '@/lib/types';
import { badgeStyle, sourceLabel } from './SourceBadge';

interface Props {
  onSelectEntry: (id: number) => void;
}

function fmt(n: number) { return Math.round(n).toLocaleString(); }

export function Foods({ onSelectEntry }: Props) {
  const entries = useStore(s => s.entries);
  const food = entries.filter(e => e.type === 'food');

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
      <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 2 }}>
        Today&apos;s food
      </div>
      <div style={{ fontSize: 14, color: '#8a8478', marginBottom: 24 }}>
        Tap any item for the full breakdown
      </div>

      {food.length === 0 ? (
        <div style={{ fontSize: 14, color: '#aaa297' }}>
          No food logged yet — tell the coach what you ate.
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}>
          {food.map(e => (
            <FoodCard key={e.id} entry={e} onClick={() => onSelectEntry(e.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Food card ─────────────────────────────────────────────────────────────────

function FoodCard({ entry, onClick }: { entry: Entry; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const macros = `${entry.protein}p · ${entry.carbs}c · ${entry.fat}f`;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff', borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
        border: hov ? '1px solid #cfc6b8' : '1px solid #ece6dc',
        transition: 'border-color .12s',
      }}
    >
      {/* Striped photo placeholder */}
      <div style={{
        height: 96,
        backgroundImage: 'repeating-linear-gradient(45deg,#f1ece3,#f1ece3 8px,#ece6db 8px,#ece6db 16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          color: '#b3a89a', letterSpacing: '0.06em',
        }}>meal photo</span>
      </div>

      <div style={{ padding: '14px 16px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'baseline', gap: 8,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{entry.name}</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: '#6b655c', flexShrink: 0,
          }}>{fmt(entry.kcal)}</span>
        </div>
        <div style={{ fontSize: 12.5, color: '#8a8478', marginTop: 4 }}>{macros}</div>
        <div style={{ marginTop: 10 }}>
          <span style={badgeStyle(entry.source)}>{sourceLabel(entry.source)}</span>
        </div>
      </div>
    </div>
  );
}

