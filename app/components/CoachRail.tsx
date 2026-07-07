'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useIsMobile } from '@/lib/hooks';
import { callCoach } from '@/lib/coach';
import type { CoachContext } from '@/lib/types';

interface Props {
  onClose?: () => void;
}

export function CoachRail({ onClose }: Props = {}) {
  const [inputText, setInputText]   = useState('');
  const [listening, setListening]   = useState(false);
  const [thinking,  setThinking]    = useState(false);
  const [micError,  setMicError]    = useState<string | null>(null);
  const isMobile = useIsMobile();

  const messages       = useStore(s => s.messages);
  const entries        = useStore(s => s.entries);
  const addEntries     = useStore(s => s.addEntries);
  const replaceEntries = useStore(s => s.replaceEntries);
  const removeEntry    = useStore(s => s.removeEntry);
  const pushMessage    = useStore(s => s.pushMessage);

  // Track IDs of the last coach-logged entries so corrections can replace them
  const lastAddedIdsRef = useRef<number[]>([]);

  const scrollRef      = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  // Refs so mic callbacks always see the latest values without stale closures
  const inputRef    = useRef('');
  const thinkingRef = useRef(false);

  useEffect(() => { inputRef.current = inputText; }, [inputText]);
  useEffect(() => { thinkingRef.current = thinking; }, [thinking]);

  // Auto-scroll to newest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, thinking]);

  async function submit(text: string, source: 'voice' | 'text') {
    text = text.trim();
    if (!text || thinkingRef.current) return;

    // Capture context before the user message lands in the store
    const state = useStore.getState();
    const history = state.messages.slice(-6)
      .map(m => (m.role === 'user' ? 'User: ' : 'Coach: ') + m.text)
      .join('\n');
    const t = state.totals();
    const g = state.activeGoal();

    pushMessage({ role: 'user', text });
    setInputText('');
    inputRef.current = '';
    setThinking(true);
    thinkingRef.current = true;
    setMicError(null);

    const logSummary = state.entries.length > 0
      ? state.entries.map(e => `${e.name} (${e.kcal} kcal)`).join(', ')
      : 'empty';

    const ctx: CoachContext = {
      goalTitle:     g.title,
      target:        g.target,
      goalType:      g.type,
      eaten:         t.eaten,
      burned:        t.burned,
      net:           t.net,
      protein:       t.protein,
      proteinTarget: g.proteinTarget,
      history,
      logSummary,
    };

    try {
      const data = await callCoach(text, ctx);
      if (data.needsClarification) {
        pushMessage({ role: 'coach', text: data.question || 'Roughly how much did you have?' });
      } else {
        if (data.correction) {
          // Corrections and deletions: find IDs to remove, then do one atomic
          // replaceEntries call so there is never more than one dbReplaceEntries
          // in-flight. Multiple fire-and-forget DB calls racing each other was
          // causing all existing entries to be duplicated in Supabase.
          const targets = (data.correctionTargets || [])
            .map(t => t.toLowerCase().trim())
            .filter(Boolean);
          const current = useStore.getState().entries;
          let removeIds: number[];
          if (targets.length > 0) {
            removeIds = current
              .filter(e => {
                const eName = e.name.toLowerCase();
                return targets.some(t => eName === t || eName.includes(t) || t.includes(eName));
              })
              .map(e => e.id);
          } else {
            removeIds = [...lastAddedIdsRef.current];
          }
          const newEntries = data.entries.map(e => ({ ...e, source }));
          replaceEntries(removeIds, newEntries);
          lastAddedIdsRef.current = newEntries.length > 0
            ? useStore.getState().entries.slice(-newEntries.length).map(e => e.id)
            : [];
        } else if (data.entries.length > 0) {
          const entriesBefore = useStore.getState().entries;
          addEntries(data.entries.map(e => ({ ...e, source })));
          const entriesAfter = useStore.getState().entries;
          lastAddedIdsRef.current = entriesAfter
            .slice(entriesBefore.length)
            .map(e => e.id);
        }
        if (data.reply) pushMessage({ role: 'coach', text: data.reply });
      }
    } finally {
      setThinking(false);
      thinkingRef.current = false;
    }
  }

  function toggleMic() {
    if (listening) {
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SR) {
      setMicError("Voice isn't supported in this browser — type instead.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let r: any;
    try { r = new SR(); } catch {
      setMicError("Couldn't start the mic — type instead.");
      return;
    }

    recognitionRef.current = r;
    r.lang = 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (ev: any) => {
      let t = '';
      for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      setInputText(t);
      inputRef.current = t;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (ev: any) => {
      const msg =
        ev.error === 'not-allowed' || ev.error === 'service-not-allowed'
          ? 'Mic permission blocked — allow it or type instead.'
          : "Didn't catch that — try again or type.";
      setListening(false);
      setMicError(msg);
    };
    r.onend = () => {
      setListening(false);
      const txt = inputRef.current.trim();
      if (txt) submit(txt, 'voice');
    };

    setListening(true);
    setMicError(null);
    try { r.start(); } catch { setListening(false); }
  }

  const hasText = inputText.trim().length > 0;

  return (
    <div style={{
      width: isMobile ? '100%' : 340,
      flexShrink: 0, background: '#fff',
      borderLeft: '1px solid #ece6dc',
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 22px', borderBottom: '1px solid #ece6dc',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, background: '#e8f3ec',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#3f9d5f', fontWeight: 800, fontSize: 13, flexShrink: 0,
        }}>C</div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Coach</div>
        <div style={{
          marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, color: '#aaa297', letterSpacing: '0.06em',
        }}>AI · live</div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: '#f3efe8', border: 'none', borderRadius: 8,
              width: 30, height: 30, cursor: 'pointer', marginLeft: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b655c" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, padding: '20px 18px', display: 'flex', flexDirection: 'column',
          gap: 13, overflowY: 'auto',
        }}
      >
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: isUser ? 230 : 260,
                background:    isUser ? '#e8f3ec' : '#f3efe8',
                color:         isUser ? '#256b3f' : '#3a3530',
                borderRadius:  isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding:       '13px 15px',
                fontSize:      13.5,
                lineHeight:    1.5,
              }}>
                {m.text}
              </div>
            </div>
          );
        })}

        {/* Thinking dots */}
        {thinking && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              background: '#f3efe8', borderRadius: '16px 16px 16px 4px',
              padding: '14px 16px', display: 'flex', gap: 5, alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block', width: 7, height: 7,
                    borderRadius: '50%', background: '#b3a89a',
                    animation: `tdot 1.2s infinite ${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Starter prompts — shown when nothing logged yet */}
      {entries.length === 0 && !thinking && (
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
            color: '#aaa297', letterSpacing: '0.06em', textTransform: 'uppercase',
            marginBottom: 8,
          }}>Try saying</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {[
              'Two eggs and toast',
              '30 min walk',
              'Cup of chai with milk',
              '100g chicken breast',
            ].map(prompt => (
              <button
                key={prompt}
                onClick={() => submit(prompt, 'text')}
                style={{
                  background: '#f3efe8', border: '1px solid #ece6dc',
                  borderRadius: 20, padding: '7px 13px',
                  fontSize: 12.5, color: '#3a3530', cursor: 'pointer',
                  fontFamily: 'inherit', lineHeight: 1,
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mic error */}
      {micError && (
        <div style={{
          margin: '0 16px 12px', padding: '9px 13px', background: '#fbeae3',
          borderRadius: 10, fontSize: 12.5, color: '#b3502f',
        }}>
          {micError}
        </div>
      )}

      {/* Composer */}
      <div style={{ padding: 16, borderTop: '1px solid #ece6dc' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#f7f4ef', border: '1px solid #ece6dc',
          borderRadius: 26, padding: '6px 6px 6px 16px',
        }}>
          <input
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(inputText, 'text'); } }}
            placeholder={listening ? 'Listening…' : 'Say or type what you ate or did…'}
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 13.5, color: '#211e1a', padding: '6px 0', fontFamily: 'inherit',
            }}
          />

          {/* Send button — visible when there's text */}
          {hasText && (
            <div
              onClick={() => submit(inputText, 'text')}
              style={{
                width: 38, height: 38, borderRadius: '50%', background: '#211e1a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, cursor: 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>
          )}

          {/* Mic button */}
          <div
            onClick={toggleMic}
            style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              background: listening ? '#c0492f' : '#3f9d5f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(63,157,95,.4)',
              animation: listening ? 'tpulse 1.4s infinite' : 'none',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
