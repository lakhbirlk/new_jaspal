import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fetchLedger } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { LedgerEntry, PageResult } from '../../api/types';
import {
  Badge,
  Banner,
  Card,
  EmptyState,
  Loading,
  Muted,
  Pager,
  Screen,
  Title,
} from '../../components/ui';
import { formatDateTime, humanizeField } from '../../lib/format';
import { colors, spacing, typography } from '../../theme';

export default function LedgerScreen() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<PageResult<LedgerEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchLedger(page, 20));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen topInset={false}>
      <Title subtitle="Every credit grant, spend, adjustment, and expiry is recorded.">
        Credit ledger
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {loading ? <Loading /> : result && result.items.length ? (
        <>
          {result.items.map((entry) => {
            const positive = entry.amount >= 0;
            return (
              <Card key={entry.id}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h3}>{humanizeField(entry.entryType)}</Text>
                    <Muted>{formatDateTime(entry.createdAt)}</Muted>
                  </View>
                  <Text style={[styles.amount, { color: positive ? colors.success : colors.danger }]}>
                    {positive ? '+' : ''}{entry.amount}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Muted>{entry.reason || (entry.businessId ? `Business ${entry.businessId}` : '—')}</Muted>
                  <Badge label={`Balance ${entry.balanceAfter}`} tone="info" />
                </View>
              </Card>
            );
          })}
          <Pager page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} />
        </>
      ) : (
        <EmptyState title="No ledger entries" message="Credit activity will appear here after you subscribe." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  amount: { fontSize: 20, fontWeight: '800' },
});
