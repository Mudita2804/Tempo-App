'use client';

import { useStore } from '@/lib/store';
import { useIsMobile } from '@/lib/hooks';
import { sourceLabel } from './SourceBadge';

interface Props {
  selectedId: number | null;
  onClose: () => void;
}

const SOURCE_NOTE: Record<string, string> = {
  voice:  'Logged by voice — calories estimated by Tempo.',
  text:   'Typed entry — calories estimated by Tempo.',
  manual: 'Added manually.',
};

export function SlideOver({ selectedId, onClose }: Props) {
  const entries    = useStore(s => s.entries);
  const removeEntry = useStore(s => s.removeEntry);
  const updateEntry = useStore(s => s.updateEntry);
  const isMobile   = useIsMobile();

  if (selectedId === null) return null;
  const entry = entries.find(e => e.id === selectedId);
  if (!entry) return null;

  const isFood = entry.type === 'food';

  // Macro shares of caloric contribution (for slide-over bars)
  const pc = entry.protein * 4;
  const cc = entry.carbs * 4;
  const fc = entry.fat * 9;
  const mc = Math.max(1, pc + cc + fc);

  function handleRemove() {
    removeEntry(selectedId!);
    onClose();
  }

  function handleKcalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0);
    updateEntry(selectedId!, { kcal: v });
  }

  function handleMacroChange(field: 'protein' | 'carbs' | 'fat') {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0);
      updateEntry(selectedId!, { [field]: v });
    };
  }

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(33,30,26,.28)', zIndex: 40 }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        left: isMobile ? 0 : 'auto',
        width: isMobile ? '100%' : 420,
        background: '#fff', zIndex: 41,
        boxShadow: isMobile ? 'none' : '-12px 0 40px rgba(0,0,0,.12)',
        display: 'flex', flexDirection: 'column',
        animation: isMobile ? 'tslideup .28s ease' : 'tslide .28s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #ece6dc',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a8478',
          }}>
            {isFood ? 'meal' : 'activity'} detail
          </span>
          <div
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8, background: '#f3efe8',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b655c" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {isFood && (
            <div style={{
              height: 150, borderRadius: 14, marginBottom: 20,
              backgroundImage: 'repeating-linear-gradient(45deg,#f1ece3,#f1ece3 9px,#ece6db 9px,#ece6db 18px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#b3a89a', letterSpacing: '0.06em',
              }}>drop a meal photo</span>
            </div>
          )}

          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 4 }}>
            {entry.name}
          </div>
          <div style={{ fontSize: 13.5, color: '#8a8478', marginBottom: 20 }}>
            {entry.time}
            {entry.durationMin ? ` · ${entry.durationMin} min` : ''}
            {' · '}{sourceLabel(entry.source)}
          </div>

          {/* Kcal block */}
          <div style={{ padding: '16px 20px', background: '#f7f4ef', borderRadius: 14, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <input
                value={entry.kcal}
                onChange={handleKcalChange}
                inputMode="numeric"
                onFocus={e => { e.currentTarget.style.borderBottomColor = '#3f9d5f'; }}
                onBlur={e  => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                style={{
                  fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em',
                  color: isFood ? '#211e1a' : '#3f9d5f',
                  background: 'transparent', border: 'none',
                  borderBottom: '2px solid transparent', outline: 'none',
                  width: 118, fontFamily: 'inherit', padding: '0 0 2px',
                }}
              />
              <span style={{ fontSize: 14, color: '#8a8478' }}>
                {isFood ? 'kcal consumed' : 'kcal burned'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#aaa297' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aaa297" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Click the number to edit it manually
            </div>
          </div>

          {/* Macros (food only) */}
          {isFood && (
            <>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                letterSpacing: '0.08em', color: '#8a8478', marginBottom: 12,
              }}>MACRONUTRIENTS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 20 }}>
                {([
                  { label: 'Protein', field: 'protein' as const, grams: entry.protein, pct: Math.round(pc / mc * 100), color: '#3f9d5f' },
                  { label: 'Carbs',   field: 'carbs'   as const, grams: entry.carbs,   pct: Math.round(cc / mc * 100), color: '#c9b48a' },
                  { label: 'Fat',     field: 'fat'     as const, grams: entry.fat,     pct: Math.round(fc / mc * 100), color: '#d99a6c' },
                ]).map(({ label, field, grams, pct, color }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13.5, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600 }}>{label}</span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                        <input
                          value={grams}
                          onChange={handleMacroChange(field)}
                          inputMode="numeric"
                          onFocus={e => { e.currentTarget.style.borderBottomColor = color; }}
                          onBlur={e  => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                          style={{
                            fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
                            fontWeight: 600, color: '#211e1a',
                            background: 'transparent', border: 'none',
                            borderBottom: '2px solid transparent', outline: 'none',
                            width: 48, textAlign: 'right', padding: '0 0 1px',
                          }}
                        />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#8a8478' }}>g</span>
                      </div>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: '#ece6dc', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: color, width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 12, color: '#aaa297' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aaa297" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                Click any number to edit it
              </div>
            </>
          )}

          {/* Source */}
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            letterSpacing: '0.08em', color: '#8a8478', marginBottom: 10,
          }}>SOURCE</div>
          <div style={{
            padding: '12px 16px', border: '1px solid #ece6dc',
            borderRadius: 12, fontSize: 13.5, color: '#3a3530',
          }}>
            {SOURCE_NOTE[entry.source] ?? 'Logged by Tempo.'}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '18px 24px', borderTop: '1px solid #ece6dc', display: 'flex', gap: 10 }}>
          <button
            onClick={handleRemove}
            onMouseEnter={e => { e.currentTarget.style.background = '#fbeae3'; e.currentTarget.style.borderColor = '#f0cabd'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#ece6dc'; }}
            style={{
              flex: 1, border: '1px solid #ece6dc', borderRadius: 11, padding: 13,
              fontSize: 14, fontWeight: 600, color: '#b3502f', cursor: 'pointer',
              background: 'transparent', fontFamily: 'inherit',
            }}
          >Remove</button>
          <button
            onClick={onClose}
            style={{
              flex: 1, background: '#211e1a', color: '#fff', border: 'none',
              borderRadius: 11, padding: 13, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Done</button>
        </div>
      </div>
    </>
  );
}
