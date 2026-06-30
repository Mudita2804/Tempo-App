import type { Source } from '@/lib/types';

export function badgeStyle(_source: Source): React.CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    letterSpacing: '0.04em',
    padding: '2px 7px',
    borderRadius: 6,
    flexShrink: 0,
    background: '#f1ece3',
    color: '#a59a89',
  };
}

export function sourceLabel(source: Source): string {
  if (source === 'voice') return 'voice';
  if (source === 'text') return 'typed';
  return 'manual';
}

export function SourceBadge({ source }: { source: Source }) {
  return <span style={badgeStyle(source)}>{sourceLabel(source)}</span>;
}
