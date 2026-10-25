import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  activateUser,
  adminResetMfa,
  adminResetPassword,
  approveUser,
  fetchAdminUser,
  rejectUser,
  suspendUser,
  updateAdminUser,
} from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { AdminUser } from '../../api/types';
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
import { formatDateTime, roleLabel, statusTone, titleCase } from '../../lib/format';
import { spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AdminStackParamList, 'UserDetail'>;

export default function UserDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetchAdminUser(id);
      setUser(response);
      setRole(response.role);
      setStatus(response.status);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setActionBusy(key);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      setConfirmAction(null);
      setRejectOpen(false);
      setReason('');
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setActionBusy(null);
    }
  };

  const resetPassword = async () => {
    setActionBusy('password');
    setError(null);
    try {
      const response = await adminResetPassword(id);
      setMessage(
        response.temporaryPassword
          ? `Temporary password: ${response.temporaryPassword}`
          : response.message ?? 'A reset link was issued.',
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setActionBusy(null);
    }
  };

  const saveRoleStatus = () => run(
    'save',
    () => updateAdminUser(id, { role, status }),
    'Account role and status updated.',
  );

  if (loading) return <Screen topInset={false}><Loading /></Screen>;
  if (!user) return <Screen topInset={false}><Muted>User not found.</Muted></Screen>;

  return (
    <Screen topInset={false}>
      <View style={styles.heading}>
        <Text style={typography.title}>{user.fullName || user.email}</Text>
        <View style={styles.badges}>
          <Badge label={roleLabel(user.role)} tone="info" />
          <Badge label={titleCase(user.status)} tone={statusTone(user.status)} />
          {user.mfaEnabled ? <Badge label="MFA enabled" tone="success" /> : <Badge label="No MFA" tone="warning" />}
        </View>
      </View>

      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}

      <Card>
        <KeyValue label="Email" value={user.email} />
        <KeyValue label="Email verified" value={user.emailVerified ? 'Yes' : 'No'} />
        <KeyValue label="Registered" value={formatDateTime(user.createdAt)} />
        <KeyValue label="Submitted for review" value={formatDateTime(user.submittedAt)} />
        {user.reviewNote ? <KeyValue label="Reviewer note" value={user.reviewNote} /> : null}
      </Card>

      {user.researcherProfile ? (
        <Card>
          <Text style={typography.h3}>Researcher profile</Text>
          <View style={{ marginTop: spacing.sm }}>
            <KeyValue label="Organization" value={user.researcherProfile.organization ?? '—'} />
            <KeyValue label="Designation" value={user.researcherProfile.designation ?? '—'} />
            <KeyValue label="Phone" value={user.researcherProfile.phone ?? '—'} />
            <KeyValue label="Purpose" value={user.researcherProfile.purposeOfResearch ?? '—'} />
          </View>
        </Card>
      ) : null}

      {user.business ? (
        <Card>
          <Text style={typography.h3}>Business</Text>
          <View style={{ marginTop: spacing.sm }}>
            {Object.entries(user.business).map(([key, value]) => (
              <KeyValue
                key={key}
                label={titleCase(key.replace(/([A-Z])/g, ' $1'))}
                value={value === null || value === undefined ? '—' : String(value)}
              />
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Review actions</SectionTitle>
        {user.status === 'pending_review' ? (
          <>
            <Button
              title="Approve profile"
              variant="success"
              loading={actionBusy === 'approve'}
              onPress={() => run('approve', () => approveUser(id), 'Profile approved.')}
            />
            <Button
              title="Reject profile"
              variant="danger"
              onPress={() => setRejectOpen((open) => !open)}
              style={{ marginTop: spacing.sm }}
            />
            {rejectOpen ? (
              <View style={{ marginTop: spacing.md }}>
                <Field
                  label="Reason for rejection"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  placeholder="Explain what the user needs to correct"
                />
                <Button
                  title="Send rejection"
                  variant="danger"
                  disabled={!reason.trim()}
                  loading={actionBusy === 'reject'}
                  onPress={() => run('reject', () => rejectUser(id, reason.trim()), 'Profile returned to the user.')}
                />
              </View>
            ) : null}
          </>
        ) : (
          <>
            {user.status === 'suspended' ? (
              <Button
                title="Reactivate account"
                variant="success"
                loading={actionBusy === 'activate'}
                onPress={() => run('activate', () => activateUser(id), 'Account reactivated.')}
              />
            ) : (
              <>
                {confirmAction === 'suspend' ? (
                  <>
                    <Button
                      title="Confirm suspension"
                      variant="danger"
                      loading={actionBusy === 'suspend'}
                      onPress={() => run('suspend', () => suspendUser(id), 'Account suspended.')}
                    />
                    <Button title="Cancel" variant="ghost" onPress={() => setConfirmAction(null)} style={{ marginTop: spacing.sm }} />
                  </>
                ) : (
                  <Button
                    title="Suspend account"
                    variant="danger"
                    onPress={() => setConfirmAction('suspend')}
                  />
                )}
              </>
            )}
          </>
        )}

        <View style={styles.inlineActions}>
          <Button
            title="Reset password"
            variant="secondary"
            small
            loading={actionBusy === 'password'}
            onPress={resetPassword}
          />
          <Button
            title="Reset MFA"
            variant="secondary"
            small
            loading={actionBusy === 'mfa'}
            onPress={() => run('mfa', () => adminResetMfa(id), 'MFA was reset.')}
          />
          <Button
            title="Policy overrides"
            variant="secondary"
            small
            onPress={() => navigation.navigate('PolicyOverrides', { userId: id, email: user.email })}
          />
        </View>
      </Card>

      <Card>
        <SectionTitle>Role and status</SectionTitle>
        <ChoiceRow
          label="Role"
          value={role}
          onChange={setRole}
          options={[
            { value: 'researcher', label: 'Researcher' },
            { value: 'business', label: 'Business' },
            { value: 'auditor', label: 'Auditor' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
        <ChoiceRow
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'pending_profile', label: 'Pending profile' },
            { value: 'pending_review', label: 'Pending review' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />
        <Button
          title="Save role and status"
          onPress={saveRoleStatus}
          loading={actionBusy === 'save'}
          disabled={role === user.role && status === user.status}
        />
      </Card>

      <SectionTitle>Documents</SectionTitle>
      <DocumentList documents={user.documents ?? []} />

      <Muted style={{ marginTop: spacing.md }}>
        User ID: {user.id}
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.lg, gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
});
