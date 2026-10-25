import { Platform } from 'react-native';

export const colors = {
  background: '#f4f6fb',
  surface: '#ffffff',
  surfaceMuted: '#eef2f9',
  primary: '#1e40af',
  primaryDark: '#172f7a',
  primarySoft: '#dbe6ff',
  accent: '#0e7490',
  text: '#0f172a',
  textSecondary: '#475569',
  muted: '#6b7280',
  border: '#dde3ee',
  success: '#047857',
  successSoft: '#d1fae5',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  info: '#1d4ed8',
  infoSoft: '#dbeafe',
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
