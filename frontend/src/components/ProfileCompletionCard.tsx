import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Completion } from '../api/types';
import { humanizeField, titleCase } from '../lib/format';
import { colors, radius, spacing, typography } from '../theme';
import { Badge, Card, Muted } from './ui';

export function ProfileCompletionCard({ completion }: { completion?: Completion | null }) {
  if (!completion) return null;
  const percent = Math.max(0, Math.min(100, completion.percent));
  return (
    <Card>
      <View style={styles.row}>
        <Text style={typography.h3}>Profile completion</Text>
        <Badge
          label={completion.complete ? 'Complete' : `${percent}%`}
          tone={completion.complete ? 'success' : 'warning'}
        />
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: completion.complete ? colors.success : colors.primary }]} />
      </View>
      <Muted style={{ marginTop: spacing.xs }}>
        {completion.present} of {completion.required} required items present
      </Muted>
      {completion.missing?.length ? (
        <View style={{ marginTop: spacing.md }}>
          <Text style={typography.label}>Still missing</Text>
          <View style={styles.badges}>
            {completion.missing.map((item) => (
              <Badge
                key={`${item.kind}-${item.name}`}
                label={item.kind === 'document' ? `${titleCase(item.name)} document` : humanizeField(item.name)}
                tone="warning"
              />
            ))}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: {
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: radius.pill },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
});
