import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchPublicBusiness } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { PublicBusiness } from '../../api/types';
import {
  Badge,
  Banner,
  Button,
  Card,
  Divider,
  KeyValue,
  Loading,
  Muted,
  Screen,
  SectionTitle,
} from '../../components/ui';
import { formatInrCompact } from '../../lib/format';
import type { PublicStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<PublicStackParamList, 'PublicBusinessDetail'>;

const LOCKED_ROWS = [
  'Legal name and trade name',
  'CIN / registration number and tax ID',
  'Contact person, email and phone',
  'Full business description and profile',
  'Business documents reviewed by an administrator',
  'Unlock with a research credit',
];

export default function PublicBusinessDetailScreen({ navigation, route }: Props) {
  const { id, publicCode } = route.params;
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBusiness(await fetchPublicBusiness(id));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Screen topInset={false}><Loading /></Screen>;

  if (!business) {
    return (
      <Screen topInset={false}>
        {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
        <Muted>This company profile is not available.</Muted>
        <Button
          title="Back to company database"
          variant="secondary"
          onPress={() => navigation.navigate('CompanyDatabase')}
          style={{ marginTop: spacing.md }}
        />
      </Screen>
    );
  }

  const initial = (business.industry ?? business.category ?? '?').charAt(0).toUpperCase();
  const location = [business.city, business.state, business.country].filter(Boolean).join(', ');

  return (
    <Screen topInset={false}>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}

      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={typography.title}>{business.public_code || publicCode}</Text>
          <Text style={[typography.bodyMuted, { marginTop: 2 }]}>
            {[business.industry, business.category].filter(Boolean).join(' · ') || 'Verified company'}
          </Text>
          <View style={styles.tags}>
            <Badge label="Identity locked" tone="warning" />
            {business.industry ? <Badge label={business.industry} tone="info" /> : null}
          </View>
        </View>
      </View>

      <View style={styles.researchBanner}>
        <Text style={styles.researchText}>
          📋 This profile is provided for <Text style={{ fontWeight: '700' }}>research, due-diligence
          and corporate-intelligence purposes only</Text>. DataOfBusiness makes no offer of
          securities, no recommendation, and facilitates no transaction. Any engagement you pursue
          with this company is private and entirely at your own discretion and risk.
        </Text>
      </View>

      <SectionTitle>Public profile</SectionTitle>
      <Card>
        <KeyValue label="Company code" value={business.public_code} mono />
        <KeyValue label="Industry" value={business.industry ?? '—'} />
        <KeyValue label="Category" value={business.category ?? '—'} />
        <KeyValue label="Location" value={location || '—'} />
        <KeyValue label="Employees" value={business.employee_count ?? '—'} />
        <KeyValue
          label="Annual revenue"
          value={business.annual_revenue === null || business.annual_revenue === undefined
            ? 'On file'
            : formatInrCompact(business.annual_revenue)}
        />
        <Divider />
        <Muted>
          Business information is supplied by the company and reviewed by an administrator before
          it is listed. Verify it independently during your due diligence.
        </Muted>
      </Card>

      <SectionTitle>Available with research access</SectionTitle>
      <Card>
        {LOCKED_ROWS.map((row) => (
          <View key={row} style={styles.lockedRow}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockedText}>{row}</Text>
          </View>
        ))}
        <Button
          title="Get research access"
          onPress={() => navigation.navigate('Register', { role: 'researcher' })}
          style={{ marginTop: spacing.md }}
        />
        <Button
          title="Back to company database"
          variant="ghost"
          onPress={() => navigation.navigate('CompanyDatabase')}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      <Card style={{ backgroundColor: colors.surfaceMuted }}>
        <Text style={typography.h3}>Why is the identity locked?</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          Company names, contacts and reviewed business documents are available to verified
          researchers only. Research access is an information subscription; it does not grant any
          right to trade, invest or transact through this platform.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '800', fontSize: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  researchBanner: {
    backgroundColor: '#EEF2FB',
    borderWidth: 1,
    borderColor: '#CBD7F2',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  researchText: { fontSize: 12, color: '#3A4A73', lineHeight: 18 },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lockIcon: { fontSize: 13 },
  lockedText: { ...typography.body, color: colors.textSecondary, flexShrink: 1 },
});
