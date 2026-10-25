import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchAuditorBusinesses } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { BusinessRecord, PageResult } from '../../api/types';
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
  Title,
} from '../../components/ui';
import type { AuditorStackParamList } from '../../navigation/types';
import { spacing } from '../../theme';

export default function AuditorBusinessListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuditorStackParamList>>();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<PageResult<BusinessRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchAuditorBusinesses({ q: query || undefined, page, size: 12 }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <Title subtitle="Read-only oversight of every business profile, including the audit trail.">
        Business oversight
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      <Card>
        <Field
          label="Search businesses"
          value={draft}
          onChangeText={setDraft}
          placeholder="Legal name, trade name, city, or industry"
          onSubmitEditing={() => {
            setPage(0);
            setQuery(draft.trim());
          }}
          returnKeyType="search"
        />
        <View style={styles.actions}>
          <Button
            title="Search"
            onPress={() => {
              setPage(0);
              setQuery(draft.trim());
            }}
            style={{ flexGrow: 1 }}
          />
          <Button
            title="Clear"
            variant="secondary"
            onPress={() => {
              setDraft('');
              setQuery('');
              setPage(0);
            }}
            style={{ flexGrow: 1 }}
          />
        </View>
      </Card>

      {loading ? <Loading /> : result && result.items.length ? (
        <>
          {result.items.map((business) => (
            <BusinessCard
              key={business.id}
              record={business}
              onPress={() => navigation.navigate('BusinessDetail', {
                id: business.id,
                title: String(business.legal_name ?? 'Business'),
              })}
            />
          ))}
          <Pager page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} />
        </>
      ) : (
        <EmptyState title="No businesses found" message="Adjust the search and try again." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
