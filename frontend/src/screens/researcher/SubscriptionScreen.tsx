import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchMySubscription } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { MySubscription } from '../../api/types';
import {
  Badge,
  Banner,
  Button,
  Card,
  KeyValue,
  Loading,
  Muted,
  Screen,
  Title,
} from '../../components/ui';
import type { ResearcherStackParamList } from '../../navigation/types';
import { formatDate, formatMoney, titleCase } from '../../lib/format';
import { colors, spacing, typography } from '../../theme';

export default function SubscriptionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ResearcherStackParamList>>();
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    fetchMySubscription()
      .then((response) => {
        if (active) setSubscription(response);
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

  const plan = subscription?.subscription?.plan;

  return (
    <Screen>
      <Title subtitle="Your plan controls how many businesses you can unlock and how long unlocks stay valid.">
        Subscription
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {loading ? <Loading /> : (
        <>
          <View style={styles.creditHero}>
            <Text style={styles.creditLabel}>Unlock credits</Text>
            <Text style={styles.creditValue}>{subscription?.creditsRemaining ?? 0}</Text>
            <Text style={styles.creditSub}>
              {subscription?.unlockedCount ?? 0} business{subscription?.unlockedCount === 1 ? '' : 'es'} unlocked
            </Text>
          </View>

          {subscription?.active && subscription.subscription ? (
            <Card>
              <View style={styles.row}>
                <Text style={typography.h2}>{plan?.name ?? 'Active plan'}</Text>
                <Badge label="Active" tone="success" />
              </View>
              <View style={{ marginTop: spacing.md }}>
                <KeyValue label="Plan code" value={plan?.code ?? '—'} mono />
                <KeyValue label="Started" value={formatDate(subscription.subscription.startsAt)} />
                <KeyValue label="Renews / ends" value={formatDate(subscription.subscription.endsAt)} />
                <KeyValue label="Credits granted" value={subscription.creditsGranted} />
                <KeyValue label="Credits remaining" value={subscription.creditsRemaining} />
                <KeyValue
                  label="Price"
                  value={plan ? formatMoney(plan.priceAmount, plan.currency) : '—'}
                />
              </View>
            </Card>
          ) : (
            <Card style={{ backgroundColor: colors.surfaceMuted }}>
              <Text style={typography.h3}>No active subscription</Text>
              <Muted style={{ marginTop: spacing.xs }}>
                Subscribe to a researcher plan to receive unlock credits and access full business
                details. Your previous unlocks become valid again when a new subscription starts.
              </Muted>
            </Card>
          )}

          {subscription?.subscription && !subscription.active ? (
            <Card>
              <Text style={typography.h3}>Previous subscription</Text>
              <Muted style={{ marginTop: spacing.xs }}>
                Status: {titleCase(subscription.subscription.status)} · ended{' '}
                {formatDate(subscription.subscription.endsAt)}
              </Muted>
            </Card>
          ) : null}

          <View style={styles.actions}>
            <Button
              title={subscription?.active ? 'View other plans' : 'Choose a plan'}
              onPress={() => navigation.navigate('Plans')}
              style={styles.action}
            />
            <Button
              title="Credit ledger"
              variant="secondary"
              onPress={() => navigation.navigate('Ledger')}
              style={styles.action}
            />
          </View>

          <Muted style={{ marginTop: spacing.sm }}>
            Unlocks are charged once per business. Re-opening an unlocked business never spends
            another credit.
          </Muted>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  creditHero: {
    backgroundColor: colors.primaryDark,
    borderRadius: 16,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  creditLabel: { color: '#c7d7ff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  creditValue: { color: colors.white, fontSize: 52, fontWeight: '800', lineHeight: 60 },
  creditSub: { color: '#d7e2ff', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, minWidth: 150 },
});
