export type PremiumThemeMode = 'dark' | 'light' | 'system';

export const premiumDark = {
  mode: 'dark' as const,
  bg: '#080D12',
  bg2: '#0D151D',
  surface: '#111A23',
  surface2: '#172231',
  surface3: '#1D2B3A',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#F8FAFC',
  textMuted: '#A7B3C2',
  textSoft: '#D7DEE8',
  primary: '#7DD3A8',
  primaryDeep: '#2F7D59',
  accent: '#9DB7FF',
  gold: '#F3C969',
  rose: '#F08CA0',
  glow: 'rgba(125,211,168,0.22)',
  glowBlue: 'rgba(157,183,255,0.18)',
  cardShadow: 'rgba(0,0,0,0.28)',
  heroGradient: ['#14231D', '#0E1726', '#080D12'] as const,
  cardGradient: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.025)'] as const,
};

export const premiumLight = {
  mode: 'light' as const,
  bg: '#F7F4EE',
  bg2: '#ECE7DD',
  surface: '#FFFFFF',
  surface2: '#F2EEE7',
  surface3: '#E7DFD3',
  border: 'rgba(24,35,46,0.10)',
  borderStrong: 'rgba(24,35,46,0.18)',
  text: '#16202B',
  textMuted: '#687483',
  textSoft: '#394654',
  primary: '#2F7D59',
  primaryDeep: '#1F5F43',
  accent: '#4267B2',
  gold: '#B98224',
  rose: '#B94E62',
  glow: 'rgba(47,125,89,0.16)',
  glowBlue: 'rgba(66,103,178,0.12)',
  cardShadow: 'rgba(24,35,46,0.10)',
  heroGradient: ['#F6EFE2', '#E8F4ED', '#F7F4EE'] as const,
  cardGradient: ['rgba(255,255,255,0.96)', 'rgba(232,244,237,0.72)'] as const,
};

export type PremiumTheme = typeof premiumDark;

export function getPremiumTheme(mode: PremiumThemeMode = 'dark', systemScheme: 'dark' | 'light' | null | undefined = 'dark') {
  const resolved = mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;
  return resolved === 'light' ? premiumLight : premiumDark;
}

export const premium = premiumDark;

export const premiumCard = {
  backgroundColor: premium.surface,
  borderColor: premium.border,
  borderWidth: 1,
  borderRadius: '$6',
};

export const premiumHeaderTitle = {
  color: premium.text,
  fontWeight: '900' as const,
  letterSpacing: -0.6,
};
