import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createSavedSearch, fetchSavedSearches, searchBusinesses } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { BusinessRecord, PageResult, SavedSearch } from '../../api/types';
import { BusinessCard } from '../../components/business';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Loading,
  Pager,
  Screen,
  SectionTitle,
  Title,
} from '../../components/ui';
import type { ResearcherStackParamList, ResearcherTabParamList } from '../../navigation/types';
import { spacing, typography } from '../../theme';

type Filters = {
  q: string;
  industry: string;
  city: string;
};

export default function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ResearcherStackParamList>>();
  const route = useRoute<RouteProp<ResearcherTabParamList, 'Search'>>();
  const [draft, setDraft] = useState<Filters>({ q: '', industry: '', city: '' });
  const [filters, setFilters] = useState<Filters>({ q: '', industry: '', city: '' });
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<PageResult<BusinessRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await searchBusinesses({
        q: filters.q.trim() || undefined,
        industry: filters.industry.trim() || undefined,
        city: filters.city.trim() || undefined,
        page,
        size: 10,
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

  useEffect(() => {
    if (!route.params) return;
    const next = {
      q: route.params.q ?? '',
      industry: route.params.industry ?? '',
      city: route.params.city ?? '',
    };
    setDraft(next);
    setFilters(next);
    setPage(0);
  }, [route.params]);

  useEffect(() => {
    fetchSavedSearches().then(setSavedSearches).catch(() => undefined);
  }, []);

  const apply = () => {
    setPage(0);
    setFilters(draft);
  };

  const reset = () => {
    const blank = { q: '', industry: '', city: '' };
    setDraft(blank);
    setFilters(blank);
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
      if (filters.industry.trim()) query.industry = filters.industry.trim();
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

  return (
    <Screen>
      <Title subtitle="Only approved businesses with an active listing appear in search results.">
        Find verified businesses
      </Title>

      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}

      <Card>
        <Field
          label="Keywords"
          value={draft.q}
          onChangeText={(q) => setDraft((current) => ({ ...current, q }))}
          placeholder="Company, product, or service"
          onSubmitEditing={apply}
          returnKeyType="search"
        />
        <View style={styles.row}>
          <View style={styles.half}>
            <Field
              label="Industry"
              value={draft.industry}
              onChangeText={(industry) => setDraft((current) => ({ ...current, industry }))}
              placeholder="e.g. Scientific equipment"
              onSubmitEditing={apply}
            />
          </View>
          <View style={styles.half}>
            <Field
              label="City"
              value={draft.city}
              onChangeText={(city) => setDraft((current) => ({ ...current, city }))}
              placeholder="e.g. Mumbai"
              onSubmitEditing={apply}
            />
          </View>
        </View>
        <View style={styles.actions}>
          <Button title="Search" onPress={apply} style={{ flexGrow: 1 }} />
          <Button title="Reset" variant="secondary" onPress={reset} style={{ flexGrow: 1 }} />
        </View>
        <View style={[styles.actions, { marginTop: spacing.sm }]}>
          <Button
            title="Saved searches"
            variant="ghost"
            small
            onPress={() => navigation.navigate('SavedSearches')}
          />
          <Button
            title={saveOpen ? 'Cancel saving' : 'Save this search'}
            variant="ghost"
            small
            onPress={() => setSaveOpen((open) => !open)}
          />
        </View>
        {saveOpen ? (
          <View style={{ marginTop: spacing.md }}>
            <Field
              label="Search name"
              value={saveName}
              onChangeText={setSaveName}
              placeholder="e.g. Mumbai lab suppliers"
            />
            <Button title="Save search" variant="secondary" onPress={save} loading={saving} disabled={saving} />
          </View>
        ) : null}
        {savedSearches.length ? (
          <Text style={[typography.small, { marginTop: spacing.sm }]}>
            {savedSearches.length} saved search{savedSearches.length === 1 ? '' : 'es'} available.
          </Text>
        ) : null}
      </Card>

      <SectionTitle>Results</SectionTitle>
      {loading ? <Loading label="Searching…" /> : result && result.items.length > 0 ? (
        <>
          {result.items.map((business) => (
            <BusinessCard
              key={business.id}
              record={business}
              locked={business.unlocked === false}
              onPress={() => navigation.navigate('BusinessDetail', {
                id: business.id,
                title: String(business.legal_name ?? 'Business'),
              })}
            />
          ))}
          <Pager page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} />
        </>
      ) : (
        <EmptyState
          title="No businesses found"
          message="Try a broader keyword or remove the industry and city filters."
          action={<Button title="Clear filters" variant="secondary" onPress={reset} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1, minWidth: 140 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
