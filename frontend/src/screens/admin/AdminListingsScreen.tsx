import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  adminCancelListing,
  adminExtendListing,
  adminListBusiness,
  adminUnlistBusiness,
  fetchAdminListings,
} from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { ListingSubscription } from '../../api/types';
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
import { formatDate, formatDateTime, formatMoney, statusTone, titleCase } from '../../lib/format';
import { spacing, typography } from '../../theme';

export default function AdminListingsScreen() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ListingSubscription[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [months, setMonths] = useState('12');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAdminListings({ status: status || undefined, page, size: 20 });
      setItems(response.items);
      setTotalPages(response.totalPages);
      setTotal(response.total);
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
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen topInset={false}>
      <Title subtitle="Listing plans purchased by businesses, including pending offline payments.">
        Listings
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
            { value: 'pending_payment', label: 'Pending payment' },
            { value: 'active', label: 'Active' },
            { value: 'expired', label: 'Expired' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      </Card>

      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyState title="No listings" message="Business listing purchases will appear here." />
      ) : items.map((listing) => (
        <Card key={listing.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={typography.h3}>{formatMoney(listing.amount, listing.currency)}</Text>
              <Muted>Business {listing.businessId}</Muted>
              <Muted>
                Purchased {formatDateTime(listing.createdAt)}
                {listing.startsAt ? ` · ${formatDate(listing.startsAt)}` : ''}
                {listing.endsAt ? ` → ${formatDate(listing.endsAt)}` : ''}
              </Muted>
            </View>
            <Badge label={titleCase(listing.status)} tone={statusTone(listing.status)} />
          </View>
          <View style={styles.actions}>
            <Button title="Allow listing" variant="success" small loading={busy === `list-${listing.id}`}
              onPress={() => act(`list-${listing.id}`, () => adminListBusiness(listing.businessId), 'Business listing allowed.')} />
            <Button title="Unlist" variant="danger" small loading={busy === `unlist-${listing.id}`}
              onPress={() => act(`unlist-${listing.id}`, () => adminUnlistBusiness(listing.businessId), 'Business unlisted.')} />
          </View>
          <View style={{ height: spacing.sm }} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Extend months" value={months} onChangeText={setMonths} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Reason" value={reason} onChangeText={setReason} placeholder="Optional" />
            </View>
          </View>
          <View style={styles.actions}>
            <Button title="Extend" variant="secondary" small loading={busy === `extend-${listing.id}`}
              onPress={() => act(`extend-${listing.id}`,
                () => adminExtendListing(listing.businessId, Number(months) || 1, reason || undefined),
                'Listing extended.')} />
            <Button title="Cancel plan" variant="danger" small loading={busy === `cancel-${listing.id}`}
              onPress={() => act(`cancel-${listing.id}`,
                () => adminCancelListing(listing.businessId, reason || undefined),
                'Listing plan cancelled.')} />
          </View>
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
