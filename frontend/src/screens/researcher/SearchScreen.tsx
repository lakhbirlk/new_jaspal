import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  createSavedSearch,
  fetchBusinessFacets,
  fetchMySubscription,
  fetchSavedSearches,
  searchBusinesses,
} from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type {
  BusinessFacets,
  BusinessRecord,
  MySubscription,
  PageResult,
  SavedSearch,
} from '../../api/types';
import { Select } from '../../components/Select';
import { Sparkline } from '../../components/Sparkline';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Loading,
  Pager,
  Screen,
} from '../../components/ui';
import type { ResearcherStackParamList, ResearcherTabParamList } from '../../navigation/types';
import { formatInrCompact } from '../../lib/format';
import { colors, radius, shadows, spacing, typography } from '../../theme';

const AVATAR_COLORS = [
  '#1E2761',
  '#0D9488',
  '#7C3AED',
  '#B45309',
  '#BE185D',
  '#1D4FA8',
  '#0F766E',
  '#9333EA',
];

const SIZE_OPTIONS = [
  { value: '', label: 'All sizes (TTM)' },
  { value: '0-200', label: 'Under ₹2 Cr' },
  { value: '200-500', label: '₹2–5 Cr' },
  { value: '500-1000', label: '₹5–10 Cr' },
  { value: '1000+', label: 'Above ₹10 Cr' },
];

/** Revenue band selected in the size filter, in rupees. */
function revenueRange(size: string): { minRevenue?: number; maxRevenue?: number } {
  switch (size) {
    case '0-200':
      return { maxRevenue: 20_000_000 };
    case '200-500':
      return { minRevenue: 20_000_000, maxRevenue: 50_000_000 };
    case '500-1000':
      return { minRevenue: 50_000_000, maxRevenue: 100_000_000 };
    case '1000+':
      return { minRevenue: 100_000_000 };
    default:
      return {};
  }
}

type Filters = {
  q: string;
  industry: string;
  state: string;
  size: string;
  city: string;
};

const EMPTY_FILTERS: Filters = { q: '', industry: '', state: '', size: '', city: '' };

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** TTM turnover, 3-year growth and trend series derived from the 36-month turnover series. */
function financials(record: BusinessRecord) {
  const turnover = Array.isArray(record.monthly_turnover) ? record.monthly_turnover : [];
  const hasTrend = turnover.length >= 2;
  const ttm = turnover.length >= 12
    ? sum(turnover.slice(-12))
    : record.annual_revenue ?? (turnover.length ? sum(turnover) : undefined);
  const firstYear = turnover.length >= 24 ? sum(turnover.slice(0, 12)) : 0;
  const growth = firstYear > 0 ? Math.round(((sum(turnover.slice(-12)) - firstYear) / firstYear) * 100) : null;
  return { turnover, hasTrend, ttm, growth };
}

function MetricRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone ? { color: tone } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function CompanyCard({
  record,
  index,
  onPress,
}: {
  record: BusinessRecord;
  index: number;
  onPress: () => void;
}) {
  const { turnover, hasTrend, ttm, growth } = financials(record);
  const unlocked = record.unlocked === true;
  const code = String(record.public_code ?? record.id.slice(0, 9).toUpperCase());
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initial = (record.industry ?? code).trim().charAt(0).toUpperCase() || 'C';
  const location = [record.city, record.state].filter(Boolean).join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Company ${code}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHead}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.cardHeadText}>
          <Text style={styles.cardName} numberOfLines={1}>{code}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {[record.industry, record.category].filter(Boolean).join(' · ') || 'Unclassified'}
          </Text>
          {location ? <Text style={styles.cardMeta} numberOfLines={1}>{location}</Text> : null}
        </View>
      </View>

      <View style={styles.tagRow}>
        <View style={[styles.tag, unlocked ? styles.tagUnlocked : styles.tagCode]}>
          <Text style={[styles.tagText, unlocked ? styles.tagUnlockedText : styles.tagCodeText]}>
            {unlocked ? '✓ Identity unlocked' : '🔒 Code only'}
          </Text>
        </View>
        {record.category ? (
          <View style={[styles.tag, styles.tagSector]}>
            <Text style={[styles.tagText, styles.tagSectorText]}>{record.category}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.spark}>
        {hasTrend ? <Sparkline data={turnover} color={color} height={54} width={300} /> : null}
      </View>

      <View style={styles.metrics}>
        <MetricRow label="TTM Turnover" value={ttm === undefined ? '—' : formatInrCompact(ttm)} />
        <MetricRow
          label="3-Yr Growth"
          value={growth === null ? '—' : `${growth >= 0 ? '+' : ''}${growth}%`}
          tone={growth === null ? undefined : growth >= 0 ? colors.success : colors.danger}
        />
        <MetricRow label="Net Profit" value={formatInrCompact(record.net_profit)} />
        <MetricRow label="Net Worth" value={formatInrCompact(record.net_worth)} />
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ResearcherStackParamList>>();
  const route = useRoute<RouteProp<ResearcherTabParamList, 'Search'>>();
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<PageResult<BusinessRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facets, setFacets] = useState<BusinessFacets>({ industries: [], states: [] });
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { minRevenue, maxRevenue } = revenueRange(filters.size);
      const response = await searchBusinesses({
        q: filters.q.trim() || undefined,
        industry: filters.industry || undefined,
        state: filters.state || undefined,
        city: filters.city.trim() || undefined,
        minRevenue,
        maxRevenue,
        page,
        size: 12,
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

  // Debounce free-text search so each keystroke does not hit the API.
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((active) => (active.q === draft.q ? active : { ...active, q: draft.q }));
      setPage(0);
    }, 350);
    return () => clearTimeout(id);
  }, [draft.q]);

  useEffect(() => {
    fetchBusinessFacets().then(setFacets).catch(() => undefined);
    fetchSavedSearches().then(setSavedSearches).catch(() => undefined);
  }, []);

  const loadRef = useRef(load);
  const hydrated = useRef(false);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // Refresh credits and results when returning from a company profile (an unlock may have happened).
  useFocusEffect(
    useCallback(() => {
      fetchMySubscription().then(setSubscription).catch(() => undefined);
      if (hydrated.current) {
        void loadRef.current();
      } else {
        hydrated.current = true;
      }
    }, []),
  );

  useEffect(() => {
    if (!route.params) return;
    const next: Filters = {
      ...EMPTY_FILTERS,
      q: route.params.q ?? '',
      industry: route.params.industry ?? '',
      state: route.params.state ?? '',
      city: route.params.city ?? '',
    };
    setDraft(next);
    setFilters(next);
    setPage(0);
  }, [route.params]);

  const applyFilter = (key: keyof Filters, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(0);
  };

  const reset = () => {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(0);
  };

  const save = async () => {
    if (!saveName.trim()) {
      setError('Give this search a name first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const query: Record<string, unknown> = {};
      if (filters.q.trim()) query.q = filters.q.trim();
      if (filters.industry) query.industry = filters.industry;
      if (filters.state) query.state = filters.state;
      if (filters.city.trim()) query.city = filters.city.trim();
      const created = await createSavedSearch(saveName.trim(), query);
      setSavedSearches((current) => [created, ...current]);
      setSaveName('');
      setSaveOpen(false);
      setMessage('Search saved.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const industryOptions = [
    { value: '', label: 'All categories' },
    ...facets.industries.map((industry) => ({ value: industry, label: industry })),
  ];
  const stateOptions = [
    { value: '', label: 'All states' },
    ...facets.states.map((state) => ({ value: state, label: state })),
  ];
  const active = subscription?.active === true;
  const credits = subscription?.creditsRemaining ?? 0;

  return (
    <Screen contentWidth={1080}>
      <View style={styles.boardHead}>
        <View style={styles.boardHeadText}>
          <Text style={styles.boardTitle}>Company Database</Text>
          <Text style={styles.boardSub}>
            Verified company financials for research &amp; due diligence — full details unlock with
            research access
          </Text>
        </View>
        {active ? (
          <View style={styles.memberPill}>
            <Text style={styles.memberPillText}>⬇ {credits} profile downloads left</Text>
          </View>
        ) : null}
      </View>

      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}

      {subscription !== null && !active ? (
        <View style={styles.lockNote}>
          <Text style={styles.lockNoteText}>
            🔒 You are viewing limited data. Subscribe to a research plan to unlock company
            identities, financial statements and contact details.
          </Text>
          <Button title="Get access" small onPress={() => navigation.navigate('Plans')} />
        </View>
      ) : null}

      <View style={styles.filters}>
        <TextInput
          value={draft.q}
          onChangeText={(q) => setDraft((current) => ({ ...current, q }))}
          placeholder="Search sector, state, company code…"
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => {
            setFilters(draft);
            setPage(0);
          }}
          accessibilityLabel="Search companies"
        />
        <View style={styles.filterSelect}>
          <Select
            value={draft.industry}
            options={industryOptions}
            onChange={(value) => applyFilter('industry', value)}
            accessibilityLabel="Category"
          />
        </View>
        <View style={styles.filterSelect}>
          <Select
            value={draft.state}
            options={stateOptions}
            onChange={(value) => applyFilter('state', value)}
            accessibilityLabel="State"
          />
        </View>
        <View style={styles.filterSelect}>
          <Select
            value={draft.size}
            options={SIZE_OPTIONS}
            onChange={(value) => applyFilter('size', value)}
            accessibilityLabel="Company size"
          />
        </View>
      </View>

      {loading ? (
        <Loading label="Loading companies…" />
      ) : result && result.items.length > 0 ? (
        <>
          <View style={styles.grid}>
            {result.items.map((business, index) => (
              <CompanyCard
                key={business.id}
                record={business}
                index={index}
                onPress={() =>
                  navigation.navigate('BusinessDetail', {
                    id: business.id,
                    title: String(business.public_code ?? 'Company profile'),
                  })
                }
              />
            ))}
          </View>
          <Pager
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            onPage={setPage}
          />
        </>
      ) : (
        <EmptyState
          title="No companies match your filters"
          message="Try a broader keyword or clear the category, state and size filters."
          action={<Button title="Clear filters" variant="secondary" onPress={reset} />}
        />
      )}

      <View style={styles.utilityRow}>
        <Button
          title={`Saved searches (${savedSearches.length})`}
          variant="ghost"
          small
          onPress={() => navigation.navigate('SavedSearches')}
        />
        <Button
          title={saveOpen ? 'Cancel' : 'Save this search'}
          variant="ghost"
          small
          onPress={() => setSaveOpen((open) => !open)}
        />
      </View>
      {saveOpen ? (
        <Card style={{ marginTop: spacing.sm }}>
          <Field
            label="Search name"
            value={saveName}
            onChangeText={setSaveName}
            placeholder="e.g. Mumbai lab suppliers"
          />
          <Button
            title="Save search"
            variant="secondary"
            onPress={save}
            loading={saving}
            disabled={saving}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  boardHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xl,
    marginTop: spacing.xs,
  },
  boardHeadText: { flexGrow: 1, flexShrink: 1, minWidth: 240 },
  boardTitle: { fontSize: 26, fontWeight: '800', color: colors.text },
  boardSub: { ...typography.bodyMuted, marginTop: spacing.xs, fontSize: 13 },
  memberPill: {
    backgroundColor: '#E8F7F1',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  memberPillText: { color: '#0B6B4F', fontSize: 12, fontWeight: '700' },
  lockNote: {
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: '#F2DFAC',
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  lockNoteText: { color: '#7A5A12', fontSize: 13, lineHeight: 19, flexGrow: 1, flexShrink: 1, minWidth: 220 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
    marginBottom: spacing.xl,
    zIndex: 2,
  },
  searchInput: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 200,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 46,
    outlineStyle: 'none',
  } as object,
  filterSelect: { minWidth: 150, flexShrink: 0, maxWidth: 240 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  card: {
    flexBasis: 320,
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: 520,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl - 2,
    ...shadows.card,
  },
  cardPressed: { opacity: 0.9, transform: [{ translateY: -2 }] },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 2, marginBottom: spacing.md },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  cardHeadText: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  tag: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
  tagUnlocked: { backgroundColor: '#E8F7F1' },
  tagUnlockedText: { color: '#0B6B4F' },
  tagCode: { backgroundColor: '#F1F2F7' },
  tagCodeText: { color: '#5A6478' },
  tagSector: { backgroundColor: colors.surfaceMuted },
  tagSectorText: { color: colors.muted },
  spark: { height: 54, marginTop: spacing.xs, marginBottom: spacing.md },
  metrics: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: colors.border,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricValue: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  utilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
