import React, { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchUnlockedBusinesses } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { BusinessRecord } from '../../api/types';
import { BusinessCard } from '../../components/business';
import { Banner, EmptyState, Loading, Muted, Screen, Title } from '../../components/ui';
import type { ResearcherStackParamList } from '../../navigation/types';
import { formatDate } from '../../lib/format';

type UnlockedRecord = BusinessRecord & { unlockedAt?: string };

export default function UnlockedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ResearcherStackParamList>>();
  const [items, setItems] = useState<UnlockedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await fetchUnlockedBusinesses()) as unknown as UnlockedRecord[]);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  return (
    <Screen>
      <Title subtitle="Businesses you have unlocked with credits while your subscription is active.">
        Unlocked businesses
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyState
          title="No unlocked businesses yet"
          message="Search the directory and unlock a business to see its full verified profile."
          action={null}
        />
      ) : (
        items.map((business) => (
          <React.Fragment key={String(business.id)}>
            <BusinessCard
              record={business}
              onPress={() => navigation.navigate('BusinessDetail', {
                id: String(business.id),
                title: String(business.legal_name ?? 'Business'),
              })}
            />
            {business.unlockedAt ? (
              <Muted style={{ marginTop: -6, marginBottom: 12 }}>
                Unlocked {formatDate(business.unlockedAt)}
              </Muted>
            ) : null}
          </React.Fragment>
        ))
      )}
    </Screen>
  );
}
