import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Compact dropdown used by the company database filters. It mirrors the native select on the
 * web build and opens a modal list on mobile, where no native picker is available.
 */
export function Select({
  value,
  options,
  onChange,
  accessibilityLabel,
  disabled,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  const choose = (next: string) => {
    setOpen(false);
    onChange(next);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? selected?.label}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.control,
          disabled && { opacity: 0.5 },
          pressed && { borderColor: colors.primary },
        ]}
      >
        <Text style={styles.controlText} numberOfLines={1}>
          {selected?.label ?? 'Select'}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{accessibilityLabel ?? 'Choose an option'}</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => choose(option.value)}
                    style={({ pressed }) => [
                      styles.option,
                      active && { backgroundColor: colors.primarySoft },
                      pressed && { backgroundColor: colors.surfaceMuted },
                    ]}
                  >
                    <Text style={[styles.optionText, active && { fontWeight: '700' }]}>
                      {option.label}
                    </Text>
                    {active ? <Text style={styles.tick}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    minHeight: 46,
  },
  controlText: { ...typography.body, flexShrink: 1 },
  chevron: { color: colors.muted, fontSize: 12 },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  sheetTitle: { ...typography.h3, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  optionText: { ...typography.body, flex: 1 },
  tick: { color: colors.primary, fontWeight: '700' },
});
