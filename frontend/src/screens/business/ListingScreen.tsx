import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchMyListing } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { MyListing } from '../../api/types';
import {
  Badge,
  Banner,
  Button,
  Card,
  KeyValue,
  Loading,
  Muted,
  Screen,
  SectionTitle,
  Title,
} from '../../components/ui';
import type { BusinessStackParamList } from '../../navigation/types';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  statusTone,
  titleCase,
} from '../../lib/format';
import { colors, spacing, typography } from '../../theme';

export default function ListingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BusinessStackParamList>>();
  const [listing, setListing] = useState<MyListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    fetchMyListing()
      .then((response) => {
        if (active) setListing(response);
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

  const pending = listing?.history.find((item) => item.status === 'pending_payment');

  return (
    <Screen>
      <Title subtitle="A listing makes your approved business discoverable by researchers.">
        Listing
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {loading ? <Loading /> : listing ? (
        <>
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={typography.h2}>{titleCase(listing.listingStatus)}</Text>
                <Muted style={{ marginTop: 2 }}>
                  Admin status: {titleCase(listing.adminListingStatus)}
                </Muted>
              </View>
              <Badge
                label={titleCase(listing.listingStatus)}
                tone={statusTone(listing.listingStatus)}
              />
            </View>
            <View style={{ marginTop: spacing.md }}>
              <KeyValue label="Listed until" value={listing.listedUntil ? formatDate(listing.listedUntil) : '—'} />
              <KeyValue
                label="Most recent purchase"
                value={listing.history[0] ? formatDateTime(listing.history[0].createdAt) : '—'}
              />
            </View>
            <View style={styles.actions}>
              <Button
                title={listing.listingStatus === 'listed' ? 'Extend listing' : 'Buy a listing plan'}
                onPress={() => navigation.navigate('Plans')}
              />
            </View>
          </Card>

          {pending ? (
            <Card style={{ backgroundColor: colors.warningSoft }}>
              <Text style={typography.h3}>Payment pending</Text>
              <Muted style={{ marginTop: spacing.xs }}>
                Your purchase of {formatMoney(pending.amount, pending.currency)} is awaiting offline
                confirmation. An administrator marks the payment as paid to activate the listing.
              </Muted>
            </Card>
          ) : null}

          <SectionTitle>Purchase history</SectionTitle>
          {listing.history.length === 0 ? (
            <Muted>No listing purchases yet.</Muted>
          ) : listing.history.map((entry) => (
            <Card key={entry.id}>
              <View style={styles.row}>
                <Text style={typography.h3}>{formatMoney(entry.amount, entry.currency)}</Text>
                <Badge label={titleCase(entry.status)} tone={statusTone(entry.status)} />
              </View>
              <Muted style={{ marginTop: spacing.xs }}>
                Purchased {formatDateTime(entry.createdAt)}
                {entry.startsAt ? ` · starts ${formatDate(entry.startsAt)}` : ''}
                {entry.endsAt ? ` · ends ${formatDate(entry.endsAt)}` : ''}
              </Muted>
            </Card>
          ))}

          <SectionTitle>Payments</SectionTitle>
          {listing.payments.length === 0 ? (
            <Muted>No payments recorded.</Muted>
          ) : listing.payments.map((payment) => (
            <Card key={payment.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3}>{formatMoney(payment.amount, payment.currency)}</Text>
                  <Muted>{payment.provider} · {formatDateTime(payment.createdAt)}</Muted>
                </View>
                <Badge label={titleCase(payment.status)} tone={statusTone(payment.status)} />
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
});
