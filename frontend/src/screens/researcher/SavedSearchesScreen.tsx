import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { deleteSavedSearch, fetchSavedSearches } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { SavedSearch } from '../../api/types';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Loading,
  Muted,
  Screen,
  Title,
} from '../../components/ui';
import type { ResearcherStackParamList } from '../../navigation/types';
import { formatDateTime } from '../../lib/format';
import { spacing, typography } from '../../theme';

export default function SavedSearchesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ResearcherStackParamList>>();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await fetchSavedSearches());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const run = (saved: SavedSearch) => {
    const query = saved.query ?? {};
    navigation.navigate('ResearcherTabs', {
      screen: 'Search',
      params: {
        q: typeof query.q === 'string' ? query.q : undefined,
        industry: typeof query.industry === 'string' ? query.industry : undefined,
        city: typeof query.city === 'string' ? query.city : undefined,
        state: typeof query.state === 'string' ? query.state : undefined,
      },
    });
  };

  const remove = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await deleteSavedSearch(id);
      setItems((current) => current.filter((item) => item.id !== id));
      setConfirmDelete(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen topInset={false}>
      <Title subtitle="Re-run a saved filter set without retyping it.">Saved searches</Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyState title="No saved searches" message="Use “Save this search” on the search screen to add one." />
      ) : items.map((saved) => (
        <Card key={saved.id}>
          <Text style={typography.h3}>{saved.name}</Text>
          <Muted style={{ marginTop: spacing.xs }}>
            {Object.entries(saved.query ?? {})
              .filter(([, value]) => value !== null && value !== undefined && value !== '')
              .map(([key, value]) => `${key}: ${String(value)}`)
              .join(' · ') || 'No filters'}
          </Muted>
          <Muted style={{ marginTop: spacing.xs }}>Saved {formatDateTime(saved.createdAt)}</Muted>
          <View style={styles.actions}>
            <Button title="Run search" small onPress={() => run(saved)} />
            {confirmDelete !== saved.id ? (
              <Button title="Delete" variant="ghost" small onPress={() => setConfirmDelete(saved.id)} />
            ) : (
              <>
                <Button
                  title="Confirm delete"
                  variant="danger"
                  small
                  loading={busyId === saved.id}
                  onPress={() => remove(saved.id)}
                />
                <Button title="Cancel" variant="ghost" small onPress={() => setConfirmDelete(null)} />
              </>
            )}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
});
