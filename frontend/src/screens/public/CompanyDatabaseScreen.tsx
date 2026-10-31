import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchPublicBusinesses } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { PageResult, PublicBusiness } from '../../api/types';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Loading,
  Pager,
  Screen,
} from '../../components/ui';
import { formatInrCompact } from '../../lib/format';
import type { PublicStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<PublicStackParamList, 'CompanyDatabase'>;

type Filters = { q: string; industry: string; city: string };

const BLANK: Filters = { q: '', industry: '', city: '' };

export default function CompanyDatabaseScreen({ navigation }: Props) {
  const [draft, setDraft] = useState<Filters>(BLANK);
  const [filters, setFilters] = useState<Filters>(BLANK);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<PageResult<PublicBusiness> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPublicBusinesses({
        q: filters.q.trim() || undefined,
        industry: filters.industry.trim() || undefined,
        city: filters.city.trim() || undefined,
        page,
        size: 9,
      });
      setResult(response);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = () => {
    setPage(0);
    setFilters(draft);
  };

  const reset = () => {
    setDraft(BLANK);
    setFilters(BLANK);
    setPage(0);
  };

  return (
    <Screen topInset={false}>
      <View style={styles.heading}>
        <Text style={typography.title}>Company Database</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          Verified company profiles for research and due diligence. Company identity, contacts
          and financial statements unlock with research access.
        </Text>
      </View>

      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}

      <View style={styles.lockNote}>
        <Text style={styles.lockNoteText}>
          🔒 You are browsing limited data. Become a research member to unlock company names,
          reviewed business documents and contact details.
        </Text>
        <Button
          title="Get research access"
          small
          onPress={() => navigation.navigate('Register', { role: 'researcher' })}
        />
      </View>

      <Card>
        <Field
          label="Search industry, category, city or state"
          value={draft.q}
          onChangeText={(q) => setDraft((current) => ({ ...current, q }))}
          placeholder="e.g. Pharma, Pune, Gujarat"
          onSubmitEditing={apply}
          returnKeyType="search"
        />
        <View style={styles.row}>
          <View style={styles.half}>
            <Field
              label="Industry"
              value={draft.industry}
              onChangeText={(industry) => setDraft((current) => ({ ...current, industry }))}
              placeholder="e.g. Textiles"
              onSubmitEditing={apply}
            />
          </View>
          <View style={styles.half}>
            <Field
              label="City"
              value={draft.city}
              onChangeText={(city) => setDraft((current) => ({ ...current, city }))}
              placeholder="e.g. Surat"
              onSubmitEditing={apply}
            />
          </View>
        </View>
        <View style={styles.actions}>
          <Button title="Search" onPress={apply} style={{ flexGrow: 1 }} />
          <Button title="Reset" variant="secondary" onPress={reset} style={{ flexGrow: 1 }} />
        </View>
      </Card>

      {loading ? <Loading label="Loading companies…" /> : result && result.items.length > 0 ? (
        <>
          <Text style={styles.count}>
            {result.total} listed compan{result.total === 1 ? 'y' : 'ies'} match this view
          </Text>
          <View style={styles.grid}>
            {result.items.map((business, index) => (
              <PublicBusinessCard
                key={business.id}
                business={business}
                color={avatarColors[index % avatarColors.length]}
                onPress={() => navigation.navigate('PublicBusinessDetail', {
                  id: business.id,
                  publicCode: business.public_code,
                })}
              />
            ))}
          </View>
          <Pager page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} />
        </>
      ) : (
        <EmptyState
          title="No companies match this view"
          message="Try a broader keyword, or clear the industry and city filters."
          action={<Button title="Clear filters" variant="secondary" onPress={reset} />}
        />
      )}

      <Card style={styles.listCard}>
        <Text style={typography.h3}>Own a business?</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          Publish a verified company profile and appear in this research database. Listings are
          information-only — no securities, no capital raising, no transactions.
        </Text>
        <Button
          title="List your company"
          variant="secondary"
          onPress={() => navigation.navigate('Register', { role: 'business' })}
          style={{ marginTop: spacing.md }}
        />
      </Card>
    </Screen>
  );
}

const avatarColors = ['#1E2761', '#0D9488', '#7C3AED', '#B45309', '#BE185D', '#1D4FA8'];

function PublicBusinessCard({
  business,
  color,
  onPress,
}: {
  business: PublicBusiness;
  color: string;
  onPress: () => void;
}) {
  const initial = (business.industry ?? business.category ?? '?').charAt(0).toUpperCase();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.businessCard, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.cardHead}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.code}>{business.public_code}</Text>
          <Text style={styles.meta} numberOfLines={2}>
            {[business.industry, business.city, business.state].filter(Boolean).join(' · ')
              || 'Verified company'}
          </Text>
        </View>
      </View>
      <View style={styles.tags}>
        {business.industry ? <Badge label={business.industry} tone="info" /> : null}
        <Badge label="Identity locked" tone="warning" />
      </View>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Annual revenue</Text>
          <Text style={styles.metricValue}>
            {business.annual_revenue === null || business.annual_revenue === undefined
              ? 'On file'
              : formatInrCompact(business.annual_revenue)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Employees</Text>
          <Text style={styles.metricValue}>{business.employee_count ?? '—'}</Text>
        </View>
      </View>
      <Text style={styles.openHint}>View limited profile →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.lg },
  lockNote: {
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: '#F2DFAC',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  lockNoteText: { color: '#7A5A12', fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1, minWidth: 140 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  count: { ...typography.small, marginBottom: spacing.sm },
  grid: { gap: spacing.md },
  businessCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '800', fontSize: 18 },
  code: { ...typography.h3, letterSpacing: 0.3 },
  meta: { ...typography.small, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  metrics: {
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  metric: { flex: 1 },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metricValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  openHint: { ...typography.small, color: colors.primary, fontWeight: '700', marginTop: spacing.md },
  listCard: { marginTop: spacing.lg },
});
