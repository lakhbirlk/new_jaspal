import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import {
  addAuditorNote,
  fetchBusiness,
  fetchBusinessDocuments,
  unlockBusiness,
} from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { BusinessRecord, DocumentSummary } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { BusinessDetails } from '../../components/business';
import { DocumentList } from '../../components/DocumentsPanel';
import {
  Badge,
  Banner,
  Button,
  Card,
  Field,
  Loading,
  Muted,
  Screen,
  SectionTitle,
} from '../../components/ui';
import { statusTone, titleCase } from '../../lib/format';
import { colors, spacing, typography } from '../../theme';

type DetailParams = { id: string; title?: string };

export default function BusinessDetailScreen() {
  const route = useRoute<RouteProp<Record<string, DetailParams>, string>>();
  const { id, title } = route.params;
  const { user, me, refreshMe, accessFor, can } = useAuth();
  const [record, setRecord] = useState<BusinessRecord | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [note, setNote] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);

  const isResearcher = user?.role === 'researcher';
  const isAuditor = user?.role === 'auditor';

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetchBusiness(id);
      setRecord(response);
      if (isAuditor) {
        fetchBusinessDocuments(id).then(setDocuments).catch(() => undefined);
      } else if (Array.isArray(response.documents)) {
        setDocuments(response.documents as DocumentSummary[]);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id, isAuditor]);

  useEffect(() => {
    void load();
  }, [load]);

  const unlocked = record?.unlocked === true;
  const lockedFields = isResearcher && !unlocked
    ? Object.entries(me?.fieldPolicies.locked ?? {})
      .filter(([, access]) => access === 'hidden')
      .map(([field]) => field)
    : [];

  const confirmUnlock = async () => {
    setUnlocking(true);
    setError(null);
    try {
      const response = await unlockBusiness(id);
      setMessage(
        response.alreadyUnlocked
          ? 'This business was already unlocked.'
          : `Business unlocked. You have ${response.creditsRemaining} credits remaining.`,
      );
      setConfirming(false);
      await Promise.all([load(), refreshMe()]);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setUnlocking(false);
    }
  };

  const submitNote = async () => {
    if (!note.trim()) {
      setError('Write a note before saving.');
      return;
    }
    setNoteBusy(true);
    setError(null);
    try {
      await addAuditorNote(id, note.trim());
      setNote('');
      setMessage('Auditor note recorded in the audit trail.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setNoteBusy(false);
    }
  };

  return (
    <Screen topInset={false}>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}
      {loading ? <Loading /> : record ? (
        <>
          <View style={styles.heading}>
            <Text style={typography.title}>{String(record.legal_name ?? title ?? 'Business')}</Text>
            <View style={styles.badges}>
              {record.listing_status ? (
                <Badge
                  label={titleCase(String(record.listing_status))}
                  tone={statusTone(String(record.listing_status))}
                />
              ) : null}
              {isResearcher ? (
                <Badge label={unlocked ? 'Unlocked' : 'Locked'} tone={unlocked ? 'success' : 'warning'} />
              ) : null}
            </View>
          </View>

          {isResearcher ? (
            <Card style={{ backgroundColor: unlocked ? colors.successSoft : colors.surface }}>
              {unlocked ? (
                <>
                  <Text style={typography.h3}>Full access unlocked</Text>
                  <Muted style={{ marginTop: spacing.xs }}>
                    Your unlock remains valid while your subscription is active. Unlocks are
                    re-checked when your plan expires.
                  </Muted>
                </>
              ) : (
                <>
                  <Text style={typography.h3}>Unlock full business detail</Text>
                  <Muted style={{ marginTop: spacing.xs }}>
                    Contact details, financials, and registration data are restricted. Spending one
                    credit unlocks this business for the life of your subscription.
                  </Muted>
                  {lockedFields.length ? (
                    <Muted style={{ marginTop: spacing.sm }}>
                      {lockedFields.length} fields are currently hidden.
                    </Muted>
                  ) : null}
                  <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                    {!confirming ? (
                      <Button title="Unlock with 1 credit" onPress={() => setConfirming(true)} />
                    ) : (
                      <>
                        <Button
                          title="Confirm unlock (1 credit)"
                          variant="success"
                          onPress={confirmUnlock}
                          loading={unlocking}
                        />
                        <Button title="Cancel" variant="ghost" onPress={() => setConfirming(false)} />
                      </>
                    )}
                  </View>
                </>
              )}
            </Card>
          ) : null}

          <BusinessDetails record={record} accessFor={(field) => accessFor('business', field, unlocked)} />

          {documents.length ? (
            <>
              <SectionTitle>Documents</SectionTitle>
              <DocumentList documents={documents} downloadable={isAuditor} />
            </>
          ) : null}

          {isAuditor && can('audit:note') ? (
            <Card>
              <SectionTitle>Add an auditor note</SectionTitle>
              <Muted style={{ marginBottom: spacing.sm }}>
                Notes are appended to the immutable audit trail for this business.
              </Muted>
              <Field
                label="Note"
                value={note}
                onChangeText={setNote}
                multiline
                placeholder="Observation, evidence checked, or follow-up required"
              />
              <Button title="Save note" onPress={submitNote} loading={noteBusy} disabled={noteBusy} />
            </Card>
          ) : null}
        </>
      ) : (
        <Muted>Business not found.</Muted>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.lg, gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
