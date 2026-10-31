import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  fetchMySubscription,
  fetchPublicPlans,
  purchaseListing,
  startSubscriptionCheckout,
} from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { MySubscription, Plan } from '../../api/types';
import type { ResearcherStackParamList } from '../../navigation/types';
import { useAuth } from '../../auth/AuthContext';
import {
  Badge,
  Banner,
  Button,
  Card,
  Loading,
  Muted,
  Screen,
  Title,
} from '../../components/ui';
import { formatDate, formatMoney, isPlanUpgrade, titleCase } from '../../lib/format';
import { colors, spacing, typography } from '../../theme';

export default function PlansScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ResearcherStackParamList>>();
  const { user, refreshMe } = useAuth();
  const audience: 'researcher' | 'business' = user?.role === 'researcher' ? 'researcher' : 'business';
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicPlans(audience)
      .then(setPlans)
      .catch((cause) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, [audience]);

  useEffect(() => {
    if (audience !== 'researcher') return;
    fetchMySubscription().then(setSubscription).catch(() => undefined);
  }, [audience]);

  const currentPlan = subscription?.active ? subscription.subscription?.plan ?? null : null;
  const currentEndsAt = subscription?.subscription?.endsAt;

  const act = async (plan: Plan) => {
    setBusyCode(plan.code);
    setError(null);
    setMessage(null);
    try {
      if (audience === 'researcher') {
        const checkout = await startSubscriptionCheckout(plan.code);
        setConfirming(null);
        navigation.navigate('Checkout', {
          paymentId: checkout.payment.id,
          planName: checkout.plan.name,
          planCode: checkout.plan.code,
          amount: checkout.payment.amount,
          currency: checkout.payment.currency,
          credits: checkout.plan.credits,
          durationMonths: checkout.plan.durationMonths,
          upgrade: Boolean(checkout.upgrade),
          currentPlanName: checkout.currentPlan?.name,
        });
      } else {
        const result = await purchaseListing(plan.code);
        setMessage(
          `${result.message} Payment ${formatMoney(result.payment.amount, result.payment.currency)} is pending offline confirmation.`,
        );
      }
      setConfirming(null);
      await refreshMe();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyCode(null);
    }
  };

  return (
    <Screen topInset={false}>
      <Title subtitle={audience === 'researcher'
        ? 'A researcher subscription supplies unlock credits and keeps your unlocks valid while active.'
        : 'Listing plans keep your approved business visible in researcher search results.'}>
        {audience === 'researcher' ? 'Researcher plans' : 'Listing plans'}
      </Title>

      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}

      {loading ? <Loading /> : plans.map((plan) => {
        const isCurrent = currentPlan?.code === plan.code;
        const canUpgrade = currentPlan ? isPlanUpgrade(currentPlan, plan) : true;
        return (
          <Card key={plan.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={typography.h2}>{plan.name}</Text>
                <Muted>{titleCase(plan.audience)} plan · {plan.code}</Muted>
              </View>
              <Badge
                label={isCurrent ? 'Active' : `${plan.durationMonths} mo`}
                tone={isCurrent ? 'success' : 'info'}
              />
            </View>
            <Text style={[typography.h1, { marginTop: spacing.md }]}>
              {formatMoney(plan.priceAmount, plan.currency)}
            </Text>
            {audience === 'researcher' ? (
              <Muted style={{ marginTop: spacing.xs }}>{plan.credits} unlock credits included</Muted>
            ) : (
              <Muted style={{ marginTop: spacing.xs }}>
                Keeps your listing active for {plan.durationMonths} month{plan.durationMonths === 1 ? '' : 's'}
              </Muted>
            )}

            <View style={styles.actions}>
              {audience === 'researcher' ? (
                isCurrent ? (
                  <Button
                    title={`Current plan · ends ${formatDate(currentEndsAt)}`}
                    variant="secondary"
                    disabled
                    onPress={() => undefined}
                  />
                ) : currentPlan && !canUpgrade ? (
                  <Button
                    title="Unavailable on current plan"
                    variant="secondary"
                    disabled
                    onPress={() => undefined}
                  />
                ) : (
                  <Button
                    title={currentPlan ? `Upgrade to ${plan.name}` : 'Subscribe'}
                    variant="primary"
                    onPress={() => { void act(plan); }}
                    loading={busyCode === plan.code}
                  />
                )
              ) : confirming !== plan.code ? (
                <Button
                  title="Buy listing plan"
                  variant="primary"
                  onPress={() => setConfirming(plan.code)}
                />
              ) : (
                <>
                  <Button
                    title={`Confirm purchase — ${formatMoney(plan.priceAmount, plan.currency)}`}
                    variant="success"
                    onPress={() => act(plan)}
                    loading={busyCode === plan.code}
                  />
                  <Button title="Cancel" variant="ghost" onPress={() => setConfirming(null)} />
                </>
              )}
            </View>
          </Card>
        );
      })}

      {audience === 'researcher' ? (
        <Muted>
          Credits are consumed one at a time when you unlock a business.{' '}
          {currentPlan
            ? 'Upgrading activates the higher plan once its payment is confirmed, carries over your unused credits and keeps your unlocked businesses valid.'
            : 'Your subscription remains active until its end date.'}
        </Muted>
      ) : (
        <Muted style={{ backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: 12 }}>
          Business listings start after an administrator confirms the offline or provider payment.
          Until then the purchase appears as pending payment.
        </Muted>
      )}

      <Button
        title="Back"
        variant="secondary"
        onPress={() => navigation.goBack()}
        style={{ marginTop: spacing.lg }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
});
