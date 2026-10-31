import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { errorMessage } from '../../api/client';
import { fetchMySubscription, paySubscription } from '../../api/endpoints';
import type { Payment } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import {
  Badge,
  Banner,
  Button,
  Card,
  Divider,
  Muted,
  Screen,
  Title,
} from '../../components/ui';
import { formatMoney } from '../../lib/format';
import type { ResearcherStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

type CheckoutNavigation = NativeStackNavigationProp<ResearcherStackParamList, 'Checkout'>;
type CheckoutRoute = RouteProp<ResearcherStackParamList, 'Checkout'>;

export default function CheckoutScreen() {
  const navigation = useNavigation<CheckoutNavigation>();
  const route = useRoute<CheckoutRoute>();
  const { refreshMe } = useAuth();
  const {
    paymentId,
    planName,
    planCode,
    amount,
    currency,
    credits,
    durationMonths,
    upgrade,
    currentPlanName,
  } = route.params;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<Payment | null>(null);
  const [activatedCredits, setActivatedCredits] = useState<number | null>(null);

  const price = formatMoney(amount, currency);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      // Brief pause so the sandbox gateway reads like a real provider round trip.
      await new Promise((resolve) => setTimeout(resolve, 900));
      const result = await paySubscription(paymentId);
      setPaid(result);
      try {
        const activated = await fetchMySubscription();
        setActivatedCredits(activated.creditsGranted);
      } catch {
        // The success screen falls back to the plan's own credit count.
      }
      await refreshMe();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (paid) {
    return (
      <Screen topInset={false}>
        <Title subtitle={upgrade
          ? 'Your plan has been upgraded. Unused credits and unlocked businesses carried over.'
          : 'Your research plan is active and the unlock credits have been added.'}>
          Payment successful
        </Title>
        <Banner
          tone="success"
          message={`${planName} ${upgrade ? 'activated as your new plan' : 'activated'} · ${activatedCredits ?? credits} credits available`}
        />
        <Card>
          <View style={styles.row}>
            <Text style={typography.h3}>{planName}</Text>
            <Badge label="Paid" tone="success" />
          </View>
          <Muted style={{ marginTop: spacing.xs }}>{planCode}</Muted>
          <Divider />
          <Row label="Amount paid" value={price} />
          <Row label="Unlock credits" value={`${activatedCredits ?? credits}`} />
          <Row label="Valid for" value={`${durationMonths} month${durationMonths === 1 ? '' : 's'}`} />
          {upgrade && currentPlanName ? <Row label="Upgraded from" value={currentPlanName} /> : null}
          <Row label="Reference" value={paid.providerRef ?? paid.id.slice(0, 8).toUpperCase()} mono />
        </Card>
        <Button
          title="View my subscription"
          variant="success"
          onPress={() => navigation.navigate('ResearcherTabs', { screen: 'Subscription' })}
          style={{ marginTop: spacing.lg }}
        />
        <Button
          title="Browse companies"
          variant="secondary"
          onPress={() => navigation.navigate('ResearcherTabs', { screen: 'Search' })}
          style={{ marginTop: spacing.sm }}
        />
      </Screen>
    );
  }

  return (
    <Screen topInset={false}>
      <Title subtitle={upgrade
        ? 'Your current plan stays active until this payment is confirmed. Then the higher plan takes over.'
        : 'Review your plan and complete the payment to activate it.'}>
        {upgrade ? 'Upgrade' : 'Checkout'}
      </Title>

      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}

      <Card>
        <View style={styles.row}>
          <Text style={typography.h2}>{planName}</Text>
          <Badge label={upgrade ? 'Upgrade' : 'Research plan'} tone={upgrade ? 'success' : 'info'} />
        </View>
        <Muted style={{ marginTop: spacing.xs }}>{planCode}</Muted>
        {upgrade && currentPlanName ? (
          <Muted style={{ marginTop: spacing.xs }}>Replaces your current {currentPlanName} plan</Muted>
        ) : null}
        <Divider />
        <Row label="Unlock credits" value={`${credits}`} />
        <Row label="Duration" value={`${durationMonths} month${durationMonths === 1 ? '' : 's'}`} />
        <Row label="Order reference" value={paymentId.slice(0, 8).toUpperCase()} mono />
        <Divider />
        <View style={styles.row}>
          <Text style={typography.h3}>Total payable</Text>
          <Text style={typography.h2}>{price}</Text>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <View style={styles.row}>
          <Text style={typography.h3}>Payment method</Text>
          <Badge label="Test mode" tone="warning" />
        </View>
        <Muted style={{ marginTop: spacing.xs }}>
          Sandbox card gateway · settled instantly. No real money moves while the test gateway is
          enabled.
        </Muted>
      </Card>

      <View style={styles.actions}>
        <Button
          title={`Pay ${price}`}
          variant="success"
          onPress={() => { void pay(); }}
          loading={busy}
        />
        <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} disabled={busy} />
      </View>

      <Text style={[typography.small, styles.footnote]}>
        If you leave this page without paying, the plan stays pending and no credits are added.
      </Text>
    </Screen>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Muted>{label}</Muted>
      <Text style={[typography.body, mono && typography.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  footnote: { color: colors.muted, marginTop: spacing.md },
});
