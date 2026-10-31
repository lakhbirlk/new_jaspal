import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radius, shadows, spacing, typography } from '../theme';
import type { Access } from '../api/types';
import type { Tone } from '../lib/format';

// ------------------------------------------------------------------ Screen

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  topInset?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Widen the content column for board-style screens; defaults to the app width. */
  contentWidth?: number;
}

export function Screen({
  children,
  scroll = true,
  topInset = true,
  style,
  contentContainerStyle,
  contentWidth,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const inner = (
    <View
      style={[
        styles.screenInner,
        contentWidth ? { maxWidth: contentWidth } : null,
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  if (!scroll) {
    return (
      <KeyboardAvoidingView
        style={[styles.screen, style]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.screenInnerWrap,
            contentWidth ? { maxWidth: contentWidth } : null,
            { paddingTop: topInset ? insets.top : 0 },
            contentContainerStyle,
          ]}
        >
          {inner}
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, style]}
      contentContainerStyle={[styles.scrollContent, { paddingTop: (topInset ? insets.top : 0) + spacing.sm }]}
      keyboardShouldPersistTaps="handled"
    >
      {inner}
    </ScrollView>
  );
}

// ------------------------------------------------------------------ Text

export function Title({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={typography.title}>{children}</Text>
      {subtitle ? <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={typography.h2}>{children}</Text>
      {action}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={typography.label}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[typography.small, style]}>{children}</Text>;
}

// ------------------------------------------------------------------ Card

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

// ------------------------------------------------------------------ Button

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        buttonStyles[variant].container,
        small && styles.buttonSmall,
        isDisabled && { opacity: 0.5 },
        pressed && !isDisabled && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' || variant === 'success'
          ? colors.white : colors.primary} size="small" />
      ) : (
        <Text style={[styles.buttonText, buttonStyles[variant].text, small && { fontSize: 13 }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const buttonStyles: Record<ButtonVariant, { container: ViewStyle; text: { color: string } }> = {
  primary: { container: { backgroundColor: colors.primary }, text: { color: colors.white } },
  secondary: {
    container: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: '#C9CFE0' },
    text: { color: colors.primaryDark },
  },
  ghost: { container: { backgroundColor: 'transparent' }, text: { color: colors.primary } },
  danger: { container: { backgroundColor: colors.danger }, text: { color: colors.white } },
  success: { container: { backgroundColor: colors.success }, text: { color: colors.white } },
};

// ------------------------------------------------------------------ Field

interface FieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
}

export function Field({ label, error, hint, required, style, multiline, ...props }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor="#94a3b8"
        {...props}
        multiline={multiline}
        style={[
          styles.input,
          multiline && { minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.md },
          !!error && { borderColor: colors.danger },
          style,
        ]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

// ------------------------------------------------------------------ Select / choices

export function ChoiceRow({
  label,
  options,
  value,
  onChange,
  required,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      <View style={styles.choiceWrap}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[styles.choice, selected && styles.choiceSelected]}
            >
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ Badge

export function Badge({ label, tone }: { label: string; tone?: Tone }) {
  const resolved = tone ?? 'neutral';
  return (
    <View style={[styles.badge, badgeStyles[resolved].container]}>
      <Text style={[styles.badgeText, badgeStyles[resolved].text]}>{label}</Text>
    </View>
  );
}

const badgeStyles: Record<Tone, { container: ViewStyle; text: { color: string } }> = {
  success: { container: { backgroundColor: colors.successSoft }, text: { color: colors.success } },
  warning: { container: { backgroundColor: colors.warningSoft }, text: { color: colors.warning } },
  danger: { container: { backgroundColor: colors.dangerSoft }, text: { color: colors.danger } },
  info: { container: { backgroundColor: colors.infoSoft }, text: { color: colors.info } },
  neutral: { container: { backgroundColor: colors.neutralSoft }, text: { color: colors.textSecondary } },
};

// ------------------------------------------------------------------ Banner

export function Banner({
  message,
  tone = 'danger',
  onDismiss,
}: {
  message: string;
  tone?: Tone;
  onDismiss?: () => void;
}) {
  return (
    <View style={[styles.banner, bannerStyles[tone].container]}>
      <Text style={[styles.bannerText, bannerStyles[tone].text]}>{message}</Text>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={[styles.bannerText, { fontWeight: '700' }]}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const bannerStyles: Record<Tone, { container: ViewStyle; text: { color: string } }> = {
  success: { container: { backgroundColor: colors.successSoft }, text: { color: colors.success } },
  warning: { container: { backgroundColor: colors.warningSoft }, text: { color: colors.warning } },
  danger: { container: { backgroundColor: colors.dangerSoft }, text: { color: colors.danger } },
  info: { container: { backgroundColor: colors.infoSoft }, text: { color: colors.info } },
  neutral: { container: { backgroundColor: colors.surfaceMuted }, text: { color: colors.textSecondary } },
};

// ------------------------------------------------------------------ Loading / empty

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.centerBox}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[typography.small, { marginTop: spacing.sm }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.emptyBox}>
      <Text style={typography.h3}>{title}</Text>
      {message ? <Text style={[typography.bodyMuted, { marginTop: spacing.xs, textAlign: 'center' }]}>{message}</Text> : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}

// ------------------------------------------------------------------ Key/value

export function KeyValue({
  label,
  value,
  access,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  access?: Access;
  mono?: boolean;
}) {
  const hidden = access === 'hidden';
  const masked = access === 'masked';
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={[styles.kvValue, mono && typography.mono, (hidden || masked) && { color: colors.muted }]}>
        {hidden ? 'Restricted' : masked ? '••••••••' : value}
      </Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Pager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return <Muted>{total} record{total === 1 ? '' : 's'}</Muted>;
  }
  return (
    <View style={styles.pager}>
      <Button
        title="Previous"
        variant="secondary"
        small
        disabled={page <= 0}
        onPress={() => onPage(page - 1)}
      />
      <Muted>Page {page + 1} of {totalPages} · {total} records</Muted>
      <Button
        title="Next"
        variant="secondary"
        small
        disabled={page + 1 >= totalPages}
        onPress={() => onPage(page + 1)}
      />
    </View>
  );
}

// ------------------------------------------------------------------ List row

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.listRow}>
      <View style={{ flex: 1 }}>
        <Text style={typography.h3}>{title}</Text>
        {subtitle ? <Text style={[typography.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      {body}
    </Pressable>
  );
}

// ------------------------------------------------------------------ styles

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: spacing.xxl, flexGrow: 1 },
  screenInnerWrap: { flex: 1, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', padding: spacing.lg },
  screenInner: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: spacing.lg },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  button: {
    minHeight: 46,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonSmall: { minHeight: 34, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  buttonText: { fontSize: 15, fontWeight: '700' },
  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: { ...typography.label, marginBottom: spacing.xs + 2 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    fontSize: 15,
    color: colors.text,
    minHeight: 46,
    outlineStyle: 'none',
  } as object,
  fieldError: { color: colors.danger, fontSize: 12, marginTop: 4 },
  fieldHint: { color: colors.muted, fontSize: 12, marginTop: 4 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  choiceTextSelected: { color: colors.primaryDark },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: { fontSize: 13, lineHeight: 19, flexShrink: 1 },
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    alignItems: 'flex-start',
  },
  kvLabel: { ...typography.small, width: '42%' },
  kvValue: { ...typography.body, flexShrink: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
