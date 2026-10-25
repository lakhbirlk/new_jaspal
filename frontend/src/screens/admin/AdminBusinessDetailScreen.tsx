import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  adminCancelListing,
  adminExtendListing,
  adminListBusiness,
  adminUnlistBusiness,
  fetchAdminBusiness,
  fetchBusinessDocuments,
  updateAdminBusiness,
} from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { BusinessRecord, DocumentSummary } from '../../api/types';
import { BusinessDetails } from '../../components/business';
import { DocumentList } from '../../components/DocumentsPanel';
import {
  Badge,
  Banner,
  Button,
  Card,
  ChoiceRow,
  Field,
  KeyValue,
  Loading,
  Muted,
  Screen,
  SectionTitle,
} from '../../components/ui';
import type { AdminStackParamList } from '../../navigation/types';
import { statusTone, titleCase } from '../../lib/format';
import { spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminBusinessDetail'>;

export default function AdminBusinessDetailScreen({ route }: Props) {
  const { id } = route.params;
  const [record, setRecord] = useState<BusinessRecord | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [verification, setVerification] = useState('unverified');
  const [months, setMonths] = useState('12');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetchAdminBusiness(id);
      setRecord(response);
      setVerification(String(response.verification_status ?? 'unverified'));
      if (Array.isArray(response.documents)) setDocuments(response.documents as DocumentSummary[]);
      else setDocuments(await fetchBusinessDocuments(id));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  if (loading) return <Screen topInset={false}><Loading /></Screen>;
  if (!record) return <Screen topInset={false}><Muted>Business not found.</Muted></Screen>;

  return (
    <Screen topInset={false}>
      <View style={styles.heading}>
        <Text style={typography.title}>{String(record.legal_name ?? 'Business')}</Text>
        <View style={styles.badges}>
          <Badge
            label={titleCase(String(record.verification_status ?? 'unverified'))}
            tone={statusTone(String(record.verification_status ?? 'unverified'))}
          />
          <Badge
            label={titleCase(String(record.listing_status ?? 'not_approved'))}
            tone={statusTone(String(record.listing_status ?? 'not_approved'))}
          />
          <Badge
            label={`Admin: ${titleCase(String(record.admin_listing_status ?? 'unlisted'))}`}
            tone={statusTone(String(record.admin_listing_status ?? 'unlisted'))}
          />
        </View>
      </View>

      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}

      {record.owner ? (
        <Card>
          <Text style={typography.h3}>Owner</Text>
          <View style={{ marginTop: spacing.sm }}>
            <KeyValue label="Name" value={record.owner.fullName} />
            <KeyValue label="Email" value={record.owner.email} />
            <KeyValue label="Status" value={titleCase(record.owner.status)} />
            <KeyValue label="User ID" value={record.owner.id} mono />
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Verification</SectionTitle>
        <ChoiceRow
          label="Verification status"
          value={verification}
          onChange={setVerification}
          options={[
            { value: 'unverified', label: 'Unverified' },
            { value: 'verified', label: 'Verified' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
        <Button
          title="Update verification"
          onPress={() => act('verification',
            () => updateAdminBusiness(id, { verification_status: verification }),
            'Verification status updated.')}
          loading={busy === 'verification'}
        />
      </Card>

      <Card>
        <SectionTitle>Listing controls</SectionTitle>
        <Muted style={{ marginBottom: spacing.sm }}>
          Admin listing gates visibility regardless of payment state. A paid, active listing plan is
          still required for the business to appear as listed.
        </Muted>
        <View style={styles.actions}>
          <Button
            title="Allow listing"
            variant="success"
            small
            loading={busy === 'list'}
            onPress={() => act('list', () => adminListBusiness(id), 'Listing allowed.')}
          />
          <Button
            title="Unlist"
            variant="danger"
            small
            loading={busy === 'unlist'}
            onPress={() => act('unlist', () => adminUnlistBusiness(id), 'Business unlisted.')}
          />
        </View>
        <View style={{ height: spacing.md }} />
        <Field
          label="Extend by months"
          value={months}
          onChangeText={setMonths}
          keyboardType="numeric"
        />
        <Field
          label="Reason (optional)"
          value={reason}
          onChangeText={setReason}
          placeholder="Recorded in the audit trail"
        />
        <View style={styles.actions}>
          <Button
            title="Extend listing"
            variant="secondary"
            small
            loading={busy === 'extend'}
            onPress={() => act('extend',
              () => adminExtendListing(id, Number(months) || 1, reason || undefined),
              'Listing extended.')}
          />
          <Button
            title="Cancel listing plan"
            variant="danger"
            small
            loading={busy === 'cancel'}
            onPress={() => act('cancel',
              () => adminCancelListing(id, reason || undefined),
              'Listing cancelled.')}
          />
        </View>
      </Card>

      <BusinessDetails record={record} />

      <SectionTitle>Documents</SectionTitle>
      <DocumentList documents={documents} downloadable />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.lg, gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
