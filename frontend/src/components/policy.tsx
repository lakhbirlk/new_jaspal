import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Screen } from './ui';
import { colors, radius, spacing, typography } from '../theme';

/** Shared shells for the legal/policy screens (privacy, refund, terms). */

export function PolicyPage({
  title,
  updated,
  onBack,
  children,
}: {
  title: string;
  updated: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <Screen topInset={false} contentWidth={820}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.updated}>Last updated: {updated}</Text>
      {children}
      <Button title="Back to site" variant="ghost" onPress={onBack} style={styles.backButton} />
    </Screen>
  );
}

export function PolicyIntro({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.introCard}>
      <Text style={styles.introText}>{children}</Text>
    </View>
  );
}

export function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function PolicySubheading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subheading}>{children}</Text>;
}

export function PolicyParagraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

export function PolicyBullet({ lead, children }: { lead?: string; children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>
        {lead ? <Text style={styles.strong}>{lead} </Text> : null}
        {children}
      </Text>
    </View>
  );
}

export function PolicyCallout({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.callout}>
      <Text style={styles.calloutText}>{children}</Text>
    </View>
  );
}

export function PolicyNumberedList({ items }: { items: React.ReactNode[] }) {
  return (
    <>
      {items.map((item, index) => (
        <View key={index} style={styles.bulletRow}>
          <Text style={styles.number}>{index + 1}.</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

export function PolicyLink({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Text
      accessibilityRole="link"
      onPress={onPress}
      style={styles.link}
    >
      {children}
    </Text>
  );
}

export function PolicyContactCard({
  title,
  rows,
}: {
  title?: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <View style={styles.contactBlock}>
      {title ? <Text style={styles.contactTitle}>{title}</Text> : null}
      {rows.map((row) => (
        <Text key={row.label} style={styles.contactLine}>
          <Text style={styles.strong}>{row.label}: </Text>
          {row.value}
        </Text>
      ))}
    </View>
  );
}

export function PolicyStrong({ children }: { children: React.ReactNode }) {
  return <Text style={styles.strong}>{children}</Text>;
}

export function PolicyContact({ lines }: { lines: string[] }) {
  return (
    <View style={styles.contactBlock}>
      {lines.map((line) => (
        <Text key={line} style={styles.contactLine}>{line}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.text,
  },
  updated: {
    ...typography.small,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  introCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  introText: {
    ...typography.bodyMuted,
    lineHeight: 23,
  },
  strong: { fontWeight: '700', color: colors.text },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  subheading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  paragraph: {
    ...typography.body,
    lineHeight: 23,
    color: '#2C3550',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bulletDot: { color: colors.primary, fontWeight: '700', lineHeight: 23 },
  number: {
    minWidth: 18,
    color: colors.primary,
    fontWeight: '700',
    lineHeight: 23,
  },
  bulletText: {
    flex: 1,
    ...typography.body,
    lineHeight: 23,
    color: '#2C3550',
  },
  callout: {
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    backgroundColor: '#FFFBF1',
    borderTopRightRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  calloutText: {
    ...typography.body,
    lineHeight: 23,
    color: '#2C3550',
  },
  contactBlock: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  contactLine: {
    ...typography.bodyMuted,
    lineHeight: 24,
  },
  contactTitle: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  link: {
    color: colors.info,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
});
