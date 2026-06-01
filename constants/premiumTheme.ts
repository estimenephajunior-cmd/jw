export type PremiumThemeMode = 'dark' | 'light' | 'system';

/** Brand palette — content-first spiritual workspace */
export const brandColors = {
  midnight: '#07111F',
  navy: '#10223E',
  royal: '#1F4D8C',
  gold: '#D4A84F',
  champagne: '#F6E7C8',
  surface: '#FFFFFF',
  surfaceSoft: '#F8FAFC',
  textPrimary: '#081120',
  textSecondary: '#5D6878',
  textTertiary: '#8792A2',
  success: '#0F9D58',
  warning: '#E58B27',
  error: '#D64545',
} as const;

export const premiumDark = {
  mode: 'dark' as const,
  bg: brandColors.midnight,
  bg2: brandColors.navy,
  surface: '#0C1829',
  surface2: '#132640',
  surface3: '#1A3054',
  border: 'rgba(246,231,200,0.10)',
  borderStrong: 'rgba(212,168,79,0.22)',
  text: '#F4F0E8',
  textMuted: '#A8B4C8',
  textSoft: '#D8DEE8',
  textBody: '#F4F0E8',
  primary: brandColors.royal,
  primaryDeep: '#163A6E',
  accent: '#5B8FD4',
  gold: brandColors.gold,
  champagne: brandColors.champagne,
  rose: '#E8A4A4',
  violet: '#8BA4D4',
  cyan: '#6BB8C8',
  coral: '#D4A090',
  emerald: brandColors.success,
  danger: brandColors.error,
  success: brandColors.success,
  warning: brandColors.warning,
  glow: 'rgba(212,168,79,0.14)',
  glowBlue: 'rgba(31,77,140,0.28)',
  tabActiveBg: 'rgba(31,77,140,0.24)',
  cardShadow: 'rgba(0,0,0,0.45)',
  heroGradient: [brandColors.midnight, brandColors.navy, brandColors.royal] as const,
  cardGradient: ['rgba(12,24,41,0.96)', 'rgba(16,34,62,0.92)'] as const,
  cardHighlightGradient: ['rgba(19,38,64,0.98)', 'rgba(12,24,41,0.95)'] as const,
  buttonGradient: [brandColors.gold, '#B8923F'] as const,
  goldAccentGradient: [brandColors.gold, brandColors.champagne] as const,
  accentGradient: [brandColors.royal, '#2A5F9E'] as const,
  sunriseGradient: [brandColors.gold, '#E8C878', brandColors.champagne] as const,
  oceanGradient: [brandColors.royal, '#3A6BA8', brandColors.navy] as const,
  royalGradient: [brandColors.midnight, brandColors.navy, brandColors.royal] as const,
  glassBg: 'rgba(12,24,41,0.72)',
  glassBorder: 'rgba(246,231,200,0.12)',
};

export const premiumLight = {
  mode: 'light' as const,
  bg: brandColors.surfaceSoft,
  bg2: '#EEF2F7',
  surface: brandColors.surface,
  surface2: '#F1F5F9',
  surface3: '#E2E8F0',
  border: 'rgba(8,17,32,0.08)',
  borderStrong: 'rgba(31,77,140,0.16)',
  text: brandColors.textPrimary,
  textMuted: brandColors.textSecondary,
  /** API / WOL body copy — always readable on white */
  textSoft: '#3D4A5C',
  textBody: brandColors.textPrimary,
  primary: brandColors.royal,
  primaryDeep: '#163A6E',
  accent: brandColors.royal,
  gold: brandColors.gold,
  champagne: brandColors.champagne,
  rose: '#C45A5A',
  violet: '#5A6B8C',
  cyan: '#2A7A8C',
  coral: '#B86A50',
  emerald: brandColors.success,
  danger: brandColors.error,
  success: brandColors.success,
  warning: brandColors.warning,
  glow: 'rgba(31,77,140,0.08)',
  glowBlue: 'rgba(31,77,140,0.10)',
  tabActiveBg: 'rgba(31,77,140,0.12)',
  cardShadow: 'rgba(8,17,32,0.08)',
  heroGradient: [brandColors.midnight, brandColors.navy, brandColors.royal] as const,
  cardGradient: ['rgba(255,255,255,0.98)', 'rgba(248,250,252,0.95)'] as const,
  cardHighlightGradient: ['rgba(255,255,255,0.98)', 'rgba(248,250,252,0.95)'] as const,
  buttonGradient: [brandColors.gold, '#C49A42'] as const,
  goldAccentGradient: [brandColors.gold, brandColors.champagne] as const,
  accentGradient: [brandColors.royal, '#3A6BA8'] as const,
  sunriseGradient: [brandColors.royal, '#3A6BA8', brandColors.gold] as const,
  oceanGradient: [brandColors.royal, '#4A7BB8', brandColors.navy] as const,
  royalGradient: [brandColors.midnight, brandColors.navy, brandColors.royal] as const,
  glassBg: 'rgba(255,255,255,0.88)',
  glassBorder: 'rgba(31,77,140,0.10)',
};

export type PremiumTheme = typeof premiumDark;

export function getPremiumTheme(
  mode: PremiumThemeMode = 'dark',
  systemScheme: 'dark' | 'light' | null | undefined = 'dark'
) {
  const resolved = mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;
  return resolved === 'light' ? premiumLight : premiumDark;
}

export const premium = premiumDark;

export const premiumRadii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  pill: 999,
};

export const premiumSpacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const premiumType = {
  hero: { fontSize: 34, lineHeight: 42, fontWeight: '700' as const, letterSpacing: -0.8 },
  h1: { fontSize: 28, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, lineHeight: 30, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '600' as const, letterSpacing: 0.4 },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: '700' as const, textTransform: 'uppercase' as const },
  title: { fontSize: 34, lineHeight: 42, fontWeight: '700' as const, letterSpacing: -0.8 },
  lead: { fontSize: 17, lineHeight: 26, fontWeight: '500' as const },
};

/** Web loads Inter via _layout; native uses system UI fonts */
export const premiumFonts = {
  display: 'Inter Tight',
  body: 'Inter',
} as const;

export const premiumCard = {
  backgroundColor: premium.surface,
  borderColor: premium.border,
  borderWidth: 1,
  borderRadius: premiumRadii.lg,
};

export const premiumHeaderTitle = {
  color: premium.text,
  fontWeight: '700' as const,
  letterSpacing: -0.5,
};
