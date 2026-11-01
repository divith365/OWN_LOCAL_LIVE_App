export const Colors = {
  primary: '#059669',
  primaryDark: '#047857',
  primaryLight: '#10B981',
  primaryTint: '#ECFDF5',

  secondary: '#F59E0B',
  secondaryDark: '#D97706',
  secondaryLight: '#FBBF24',
  secondaryTint: '#FFFBEB',

  // Status Colors
  success: '#16A34A',
  successLight: '#DCFCE7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  info: '#2563EB',
  infoLight: '#DBEAFE',

  // Neutrals
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  white: '#FFFFFF',

  // Semantic
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const Typography = {
  title1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  title2: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  title3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const, lineHeight: 21 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, lineHeight: 21 },
  subhead: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  subheadBold: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: '500' as const, lineHeight: 15 },
  captionBold: { fontSize: 11, fontWeight: '700' as const, lineHeight: 15 },
};
