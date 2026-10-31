import { Platform } from 'react-native';

export const colors = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F8',
  primary: '#1E2761',
  primaryDark: '#141B47',
  primarySoft: '#E4E8F6',
  accent: '#B8860B',
  gold: '#E8B84B',
  text: '#1A2238',
  textSecondary: '#46506A',
  muted: '#6B7488',
  border: '#E3E7F0',
  success: '#047857',
  successSoft: '#d1fae5',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  info: '#1D4FA8',
  infoSoft: '#E7EEFB',
  neutralSoft: '#e5e7eb',
  white: '#ffffff',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const typography = {
  title: { fontSize: 26, fontWeight: '700' as const, color: colors.text },
  h1: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 15, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  bodyMuted: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  small: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.textSecondary },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 13 },
};

export const shadows = {
  card: Platform.select({
    web: { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)' },
    default: { elevation: 1 },
  }) as object,
};

export const layout = {
  maxWidth: 880,
  tabBarHeight: 60,
};
