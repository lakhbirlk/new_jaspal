import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchPublicPlans } from '../../api/endpoints';
import type { Plan } from '../../api/types';
import { errorMessage } from '../../api/client';
import { Badge, Banner, Button, Card, Screen, SectionTitle } from '../../components/ui';
import type { PublicStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { formatMoney, titleCase } from '../../lib/format';

type Props = NativeStackScreenProps<PublicStackParamList, 'Landing'>;

const roleCards = [
  {
    title: 'Researcher',
    description: 'Search verified businesses, unlock contact and financial detail with credits, and save searches.',
  },
  {
    title: 'Business',
    description: 'Publish a verified company profile, manage documents, and buy a listing plan.',
  },
  {
    title: 'Auditor & Admin',
    description: 'Review profiles and documents, govern field visibility, and manage plans and payments.',
  },
];

export default function LandingScreen({ navigation }: Props) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchPublicPlans('researcher'), fetchPublicPlans('business')])
      .then(([researcher, business]) => setPlans([...researcher, ...business]))
      .catch((cause) => setError(errorMessage(cause)));
  }, []);

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>BD</Text>
          </View>
          <Text style={styles.brandName}>Business Directory</Text>
        </View>
        <Text style={styles.heroTitle}>Verified business intelligence, governed by policy.</Text>
        <Text style={styles.heroSubtitle}>
          A multi-role directory where researchers discover verified companies, businesses publish
          trusted profiles, and administrators keep every field under control.
        </Text>
        <View style={styles.heroActions}>
          <Button title="Sign in" onPress={() => navigation.navigate('Login')} />
          <Button
            title="Create an account"
            variant="secondary"
            onPress={() => navigation.navigate('Register')}
          />
        </View>
      </View>

      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}

      <SectionTitle>Built for every role</SectionTitle>
      {roleCards.map((role) => (
        <Card key={role.title}>
          <Text style={typography.h3}>{role.title}</Text>
          <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{role.description}</Text>
        </Card>
      ))}

      {plans.length > 0 ? (
        <>
          <SectionTitle>Plans</SectionTitle>
          <View style={styles.planGrid}>
            {plans.map((plan) => (
              <Card key={plan.id} style={styles.planCard}>
                <View style={styles.planHeader}>
                  <Text style={typography.h3}>{plan.name}</Text>
                  <Badge label={titleCase(plan.audience)} tone="info" />
                </View>
                <Text style={[typography.h1, { marginTop: spacing.sm }]}>
                  {formatMoney(plan.priceAmount, plan.currency)}
                </Text>
                <Text style={typography.small}>
                  {plan.durationMonths} month{plan.durationMonths === 1 ? '' : 's'}
                  {plan.credits > 0 ? ` · ${plan.credits} unlock credits` : ''}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      <Card style={{ marginTop: spacing.md, backgroundColor: colors.surfaceMuted }}>
        <Text style={typography.h3}>Demo environment</Text>
        <Text style={[typography.small, { marginTop: spacing.xs }]}>
          Admin: admin@directory.local / Admin@12345{'\n'}
          Researcher: researcher@directory.local / Demo@12345{'\n'}
          Business: business@directory.local / Demo@12345{'\n'}
          Auditor: auditor@directory.local / Demo@12345
        </Text>
        <Text style={[typography.small, { marginTop: spacing.xs }]}>
          Administrators and auditors enrol in two-factor authentication at first sign-in.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: colors.primaryDark, fontWeight: '800', fontSize: 14 },
  brandName: { color: '#c7d7ff', fontWeight: '700', letterSpacing: 0.4 },
  heroTitle: { color: colors.white, fontSize: 28, fontWeight: '800', lineHeight: 34 },
  heroSubtitle: { color: '#d7e2ff', fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  planCard: { flexGrow: 1, minWidth: 240, flexBasis: '45%' },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
