// Design tokens — keep in sync with app/globals.css. See ../README.md for full usage.
export const color = {
  accent: '#3F9D5F',
  accentHover: '#368A53',
  accentTint: '#E8F3EC',
  accentDeep: '#256B3F',
  accentBorder: '#B6DCC3',

  ink: '#211E1A',
  ink2: '#3A3530',
  textMuted: '#6B655C',
  faint: '#8A8478',
  faint2: '#AAA297',

  page: '#F7F4EF',
  surface: '#FFFFFF',
  fill: '#F3EFE8',

  border: '#ECE6DC',
  border2: '#EFE9E0',
  track: '#ECE6DC',

  macroProtein: '#3F9D5F',
  macroCarbs: '#C9B48A',
  macroFat: '#D99A6C',

  over: '#C0492F',
  overText: '#B3502F',
  overBg: '#FBEAE3',

} as const;

export const font = {
  ui: "'Hanken Grotesk', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const layout = {
  sidebar: 222,
  coachRail: 340,
  slideOver: 420,
} as const;
