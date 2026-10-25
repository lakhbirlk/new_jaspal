import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchAdminDashboard } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { AdminDashboard } from '../../api/types';
import {
  Banner,
  Card,
  Loading,
  Muted,
  Screen,
  SectionTitle,
  Title,
} from '../../components/ui';
import { formatDateTime, humanizeField, titleCase } from '../../lib/format';
import { colors, radius, spacing, typography } from '../../theme';

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <Card style={styles.metric}>
      <Text style={[styles.metricValue, tone ? { color: tone } : undefined]}>{value}</Text>
      <Text style={typography.small}>{label}</Text>
    </Card>
  );
}

export default function AdminDashboardScreen() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    fetchAdminDashboard()
      .then((response) => {
        if (active) setDashboard(response);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []));

  return (
    <Screen>
      <Title subtitle="Platform health, review queues, and recent governance activity.">
        Control panel
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {loading ? <Loading /> : dashboard ? (
        <>
          <View style={styles.grid}>
            <Metric label="Pending user reviews" value={dashboard.pendingUsers} tone={colors.warning} />
            <Metric label="Pending documents" value={dashboard.pendingDocuments} tone={colors.warning} />
            <Metric label="Total users" value={dashboard.totalUsers} />
            <Metric label="Active subscriptions" value={dashboard.activeSubscriptions} />
            <Metric label="Listed businesses" value={dashboard.listedBusinesses} tone={colors.success} />
            <Metric label="Unlisted businesses" value={dashboard.unlistedBusinesses} />
            <Metric label="Listings expiring in 30 days" value={dashboard.listingsExpiringIn30Days} tone={colors.warning} />
            <Metric label="Credits spent this month" value={dashboard.creditsSpentThisMonth} />
          </View>

          <SectionTitle>Active users by role</SectionTitle>
          <Card>
            {Object.entries(dashboard.activeUsersByRole ?? {}).map(([role, count]) => (
              <View key={role} style={styles.row}>
                <Text style={typography.body}>{titleCase(role)}</Text>
                <Text style={typography.h3}>{count}</Text>
              </View>
            ))}
          </Card>

          <SectionTitle>Recent governance activity</SectionTitle>
          {dashboard.recentAuditEvents?.length ? dashboard.recentAuditEvents.map((event) => (
            <Card key={event.id}>
              <View style={styles.row}>
                <Text style={typography.h3}>{humanizeField(event.action)}</Text>
                <Muted>{formatDateTime(event.createdAt)}</Muted>
              </View>
              <Muted style={{ marginTop: 2 }}>
                {titleCase(event.resourceType ?? 'system')}
                {event.resourceId ? ` · ${event.resourceId}` : ''}
              </Muted>
            </Card>
          )) : <Muted>No audit events yet.</Muted>}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 130,
    marginBottom: 0,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  metricValue: { fontSize: 30, fontWeight: '800', color: colors.text, marginBottom: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
});
