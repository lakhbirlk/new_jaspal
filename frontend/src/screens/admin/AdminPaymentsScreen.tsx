import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  fetchAdminPayments,
  recordOfflinePayment,
  refundPayment,
} from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { PageResult, Payment } from '../../api/types';
import {
  Badge,
  Banner,
  Button,
  Card,
  ChoiceRow,
  EmptyState,
  Field,
  Loading,
  Muted,
  Pager,
  Screen,
  Title,
} from '../../components/ui';
import { formatDateTime, formatMoney, statusTone, titleCase } from '../../lib/format';
import { spacing, typography } from '../../theme';

export default function AdminPaymentsScreen() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<PageResult<Payment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [providerRef, setProviderRef] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchAdminPayments({ status: status || undefined, page, size: 20 }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [status, page]);

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
      setActionFor(null);
      setProviderRef('');
      setReason('');
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen topInset={false}>
      <Title subtitle="Confirm manual or offline payments and issue refunds. Payment confirmation activates the linked listing.">
        Payments
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}
      <Card>
        <ChoiceRow
          label="Status"
          value={status}
          onChange={(value) => { setStatus(value); setPage(0); }}
          options={[
            { value: '', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'paid', label: 'Paid' },
            { value: 'failed', label: 'Failed' },
            { value: 'refunded', label: 'Refunded' },
          ]}
        />
      </Card>

      {loading ? <Loading /> : result && result.items.length ? (
        <>
          {result.items.map((payment) => (
            <Card key={payment.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3}>{formatMoney(payment.amount, payment.currency)}</Text>
                  <Muted>{titleCase(payment.purpose)} · {payment.provider} · {formatDateTime(payment.createdAt)}</Muted>
                  <Muted>Reference {payment.referenceId}</Muted>
                </View>
                <Badge label={titleCase(payment.status)} tone={statusTone(payment.status)} />
              </View>

              {actionFor === payment.id ? (
                <View style={{ marginTop: spacing.md }}>
                  <Field
                    label="Provider reference"
                    value={providerRef}
                    onChangeText={setProviderRef}
                    placeholder="Offline receipt or provider transaction ID"
                  />
                  <Field
                    label="Refund reason"
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Required for refunds"
                  />
                  <View style={styles.actions}>
                    <Button
                      title="Mark as paid"
                      variant="success"
                      small
                      loading={busy === `pay-${payment.id}`}
                      onPress={() => act(`pay-${payment.id}`,
                        () => recordOfflinePayment({ paymentId: payment.id, providerRef: providerRef || undefined }),
                        'Payment recorded as paid.')}
                    />
                    <Button
                      title="Refund"
                      variant="danger"
                      small
                      disabled={!reason.trim()}
                      loading={busy === `refund-${payment.id}`}
                      onPress={() => act(`refund-${payment.id}`,
                        () => refundPayment(payment.id, reason.trim()),
                        'Payment refunded.')}
                    />
                    <Button title="Close" variant="ghost" small onPress={() => setActionFor(null)} />
                  </View>
                </View>
              ) : (
                <View style={styles.actions}>
                  <Button
                    title={payment.status === 'pending' ? 'Confirm payment' : 'Record action'}
                    variant="secondary"
                    small
                    onPress={() => {
                      setActionFor(payment.id);
                      setProviderRef(payment.providerRef ?? '');
                      setReason('');
                    }}
                  />
                </View>
              )}
            </Card>
          ))}
          <Pager page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} />
        </>
      ) : (
        <EmptyState title="No payments" message="Listing payments will appear here." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
});
