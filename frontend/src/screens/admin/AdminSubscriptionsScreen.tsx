import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  adjustSubscriptionCredits,
  cancelSubscription,
  extendSubscription,
  fetchAdminSubscriptions,
} from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { Subscription } from '../../api/types';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Loading,
  Muted,
  Pager,
  Screen,
  Title,
} from '../../components/ui';
import { formatDate, formatMoney, statusTone, titleCase } from '../../lib/format';
import { spacing, typography } from '../../theme';

export default function AdminSubscriptionsScreen() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState('1');
  const [months, setMonths] = useState('1');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAdminSubscriptions({ page, size: 20 });
      setItems(response.items);
      setTotalPages(response.totalPages);
      setTotal(response.total);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      setSelected(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen topInset={false}>
      <Title subtitle="Adjust credits, extend plans, or cancel subscriptions. Every action is audited.">
        Subscriptions
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}

      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyState title="No subscriptions" message="Researcher subscriptions will appear here." />
      ) : items.map((subscription) => (
        <Card key={subscription.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={typography.h3}>{subscription.plan?.name ?? 'Plan'}</Text>
              <Muted>{subscription.plan?.code ?? subscription.planId} · user {subscription.userId}</Muted>
            </View>
            <Badge label={titleCase(subscription.status)} tone={statusTone(subscription.status)} />
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <Muted>
              Credits {subscription.creditsRemaining} / {subscription.creditsGranted}
              {' · '}{formatDate(subscription.startsAt)} → {formatDate(subscription.endsAt)}
            </Muted>
            {subscription.plan ? (
              <Muted>{formatMoney(subscription.plan.priceAmount, subscription.plan.currency)}</Muted>
            ) : null}
          </View>
          {selected !== subscription.id ? (
            <View style={styles.actions}>
              <Button
                title="Manage"
                variant="secondary"
                small
                onPress={() => {
                  setSelected(subscription.id);
                  setAmount('1');
                  setMonths('1');
                  setReason('');
                }}
              />
              <Button title="Cancel" variant="ghost" small onPress={() => {
                setSelected(subscription.id);
                setAmount('0');
                setMonths('0');
              }} />
            </View>
          ) : (
            <View style={{ marginTop: spacing.md }}>
              <Field label="Credit adjustment" value={amount} onChangeText={setAmount} keyboardType="numeric" hint="Positive grants credits; negative removes them" />
              <Button
                title="Apply credit adjustment"
                variant="secondary"
                small
                loading={busy === 'credits'}
                onPress={() => act('credits',
                  () => adjustSubscriptionCredits(subscription.id, Number(amount) || 0, reason || undefined),
                  'Credits adjusted.')}
                style={{ marginBottom: spacing.md }}
              />
              <Field label="Extend by months" value={months} onChangeText={setMonths} keyboardType="numeric" />
              <Field label="Reason" value={reason} onChangeText={setReason} placeholder="Recorded in the audit trail" />
              <View style={styles.actions}>
                <Button
                  title="Extend"
                  small
                  loading={busy === 'extend'}
                  onPress={() => act('extend',
                    () => extendSubscription(subscription.id, Number(months) || 1, reason || undefined),
                    'Subscription extended.')}
                />
                <Button
                  title="Cancel subscription"
                  variant="danger"
                  small
                  loading={busy === 'cancel'}
                  onPress={() => act('cancel',
                    () => cancelSubscription(subscription.id, reason || undefined),
                    'Subscription cancelled.')}
                />
                <Button title="Close" variant="ghost" small onPress={() => setSelected(null)} />
              </View>
            </View>
          )}
        </Card>
      ))}

      <Pager page={page} totalPages={totalPages} total={total} onPage={setPage} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
});
