import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fetchMyBusiness, updateMyBusiness } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { BusinessRecord, Completion } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { BusinessForm, businessToForm, MissingFields, type BusinessFormValues } from '../../components/business';
import { ProfileCompletionCard } from '../../components/ProfileCompletionCard';
import { Badge, Banner, Button, Card, Loading, Screen, Title } from '../../components/ui';
import { BUSINESS_FIELDS, statusTone, titleCase } from '../../lib/format';
import { spacing, typography } from '../../theme';

export default function BusinessEditScreen({ topInset = true }: { topInset?: boolean }) {
  const { me, refreshMe } = useAuth();
  const [record, setRecord] = useState<BusinessRecord | null>(null);
  const [values, setValues] = useState<BusinessFormValues>({});
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetchMyBusiness();
      setRecord(response);
      setValues(businessToForm(response));
      if (response.profile_completion) setCompletion(response.profile_completion);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const missingFields = (completion?.missing ?? [])
    .filter((item) => item.kind === 'field')
    .map((item) => item.name);

  const change = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setError(null);
    setMessage(null);
    if (!values.legal_name?.trim()) {
      setError('Legal name is required.');
      return;
    }
    const payload: Record<string, unknown> = {};
    BUSINESS_FIELDS.forEach((field) => {
      const next = values[field.key] ?? '';
      const current = record?.[field.key] === null || record?.[field.key] === undefined
        ? '' : String(record[field.key]);
      if (next === current) return;
      if (!next.trim() && (field.key === 'annual_revenue' || field.key === 'employee_count')) return;
      payload[field.key] = field.keyboard === 'numeric' ? Number(next) : next;
    });
    if (Object.keys(payload).length === 0) {
      setMessage('No changes to save.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMyBusiness(payload);
      setRecord(updated);
      setValues(businessToForm(updated));
      if (updated.profile_completion) setCompletion(updated.profile_completion);
      setMessage('Business details saved.');
      await refreshMe();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen topInset={topInset}>
      <Title
        subtitle={me?.user.status === 'pending_review'
          ? 'Your business is under review. You can keep updating its details; documents stay locked until the review is complete.'
          : 'Complete every required field and upload the required documents before submitting for review.'}
      >
        Business profile
      </Title>

      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} /> : null}

      {loading ? <Loading /> : record ? (
        <>
          <Card>
            <View style={styles.statusRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.h2}>{String(record.legal_name ?? 'Business')}</Text>
                <Text style={typography.small}>
                  {[record.industry, record.city, record.country].filter(Boolean).join(' · ') || 'Add your company details'}
                </Text>
              </View>
              <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
                <Badge
                  label={titleCase(String(record.verification_status ?? 'unverified'))}
                  tone={statusTone(String(record.verification_status ?? 'unverified'))}
                />
                <Badge
                  label={titleCase(String(record.listing_status ?? 'not_approved'))}
                  tone={statusTone(String(record.listing_status ?? 'not_approved'))}
                />
              </View>
            </View>
            {me?.user.status === 'pending_review' ? (
              <Text style={[typography.small, { marginTop: spacing.sm }]}>
                Your business is under review. You can keep updating these details until an
                administrator approves it.
              </Text>
            ) : null}
          </Card>

          <ProfileCompletionCard completion={completion} />
          <MissingFields
            missing={missingFields}
            title={me?.user.status === 'pending_review' ? 'Still missing' : undefined}
          />

          <Card>
            <BusinessForm
              values={values}
              onChange={change}
              missing={missingFields}
            />
            <Button
              title="Save business details"
              onPress={save}
              loading={saving}
              disabled={saving}
            />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
});
