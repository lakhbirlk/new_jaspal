import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchAdminUsers, inviteUser } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { AdminUser, PageResult } from '../../api/types';
import {
  Badge,
  Banner,
  Button,
  Card,
  ChoiceRow,
  EmptyState,
  Field,
  Loading,
  ListRow,
  Muted,
  Pager,
  Screen,
  SectionTitle,
  Title,
} from '../../components/ui';
import type { AdminStackParamList } from '../../navigation/types';
import { formatDate, roleLabel, statusTone, titleCase } from '../../lib/format';
import { spacing, typography } from '../../theme';

export default function AdminUsersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<PageResult<AdminUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('auditor');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      setResult(await fetchAdminUsers({
        q: query || undefined,
        role: role || undefined,
        status: status || undefined,
        page,
        size: 20,
      }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [query, role, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(useCallback(() => {
    void load(false);
  }, [load]));

  const search = () => {
    setPage(0);
    setQuery(draft.trim());
  };

  const sendInvite = async () => {
    setInviteError(null);
    setInviteMessage(null);
    setInviteToken(null);
    if (!inviteEmail.trim() || !inviteName.trim()) {
      setInviteError('Enter the invitee’s full name and email address.');
      return;
    }
    setInviteBusy(true);
    try {
      const response = await inviteUser({
        email: inviteEmail.trim(),
        fullName: inviteName.trim(),
        role: inviteRole,
      });
      setInviteMessage(response.message ?? 'Invitation sent.');
      setInviteToken(response.devInviteToken ?? null);
      setInviteEmail('');
      setInviteName('');
      setInviteOpen(false);
      await load(false);
    } catch (cause) {
      setInviteError(errorMessage(cause));
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Review registrations, change roles, and manage account access.">
        Users
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}

      <Card>
        <SectionTitle>Invite an auditor or administrator</SectionTitle>
        <Muted>
          These roles cannot self-register. The invitee sets a password from the invite link.
          Auditors also enrol two-factor authentication before entering their workspace.
        </Muted>
        {inviteError ? (
          <Banner message={inviteError} onDismiss={() => setInviteError(null)} />
        ) : null}
        {inviteMessage ? (
          <Banner tone="success" message={inviteMessage} onDismiss={() => setInviteMessage(null)} />
        ) : null}
        {inviteToken ? (
          <View style={styles.tokenBox}>
            <Muted>Development invitation token</Muted>
            <Text selectable style={styles.token}>{inviteToken}</Text>
            <Muted>
              Share this token with the invitee. In production the same token arrives by email.
            </Muted>
          </View>
        ) : null}
        <Button
          title={inviteOpen ? 'Close invitation form' : 'Invite a user'}
          variant={inviteOpen ? 'ghost' : 'secondary'}
          onPress={() => {
            setInviteOpen((open) => !open);
            setInviteError(null);
          }}
          style={{ marginTop: spacing.md }}
        />
        {inviteOpen ? (
          <View style={{ marginTop: spacing.sm }}>
            <Field
              label="Full name"
              value={inviteName}
              onChangeText={setInviteName}
              placeholder="e.g. Priya Sharma"
              required
            />
            <Field
              label="Email"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="auditor@company.com"
              required
            />
            <ChoiceRow
              label="Role"
              value={inviteRole}
              onChange={setInviteRole}
              options={[
                { value: 'auditor', label: 'Auditor' },
                { value: 'admin', label: 'Administrator' },
              ]}
            />
            <Button
              title="Send invitation"
              onPress={sendInvite}
              loading={inviteBusy}
              disabled={inviteBusy}
            />
          </View>
        ) : null}
      </Card>

      <Card>
        <Field
          label="Search"
          value={draft}
          onChangeText={setDraft}
          placeholder="Email or full name"
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <ChoiceRow
          label="Role"
          value={role}
          onChange={(value) => { setRole(value); setPage(0); }}
          options={[
            { value: '', label: 'All' },
            { value: 'researcher', label: 'Researcher' },
            { value: 'business', label: 'Business' },
            { value: 'auditor', label: 'Auditor' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
        <ChoiceRow
          label="Status"
          value={status}
          onChange={(value) => { setStatus(value); setPage(0); }}
          options={[
            { value: '', label: 'All' },
            { value: 'pending_email', label: 'Pending email' },
            { value: 'pending_profile', label: 'Pending profile' },
            { value: 'pending_review', label: 'Pending review' },
            { value: 'active', label: 'Active' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />
        <Pressable accessibilityRole="button" onPress={search}>
          <Text style={styles.searchLink}>Apply search</Text>
        </Pressable>
      </Card>

      {loading ? <Loading /> : result && result.items.length ? (
        <>
          {result.items.map((user) => (
            <Card
              key={user.id}
              onPress={() => navigation.navigate('UserDetail', { id: user.id, email: user.email })}
            >
              <ListRow
                title={user.fullName || user.email}
                subtitle={`${user.email} · ${roleLabel(user.role)} · joined ${formatDate(user.createdAt)}`}
                right={<Badge label={titleCase(user.status)} tone={statusTone(user.status)} />}
              />
              {user.businessName || user.organization ? (
                <Muted style={{ marginTop: spacing.xs }}>
                  {user.businessName ?? user.organization}
                </Muted>
              ) : null}
            </Card>
          ))}
          <Pager page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} />
        </>
      ) : (
        <EmptyState title="No users match" message="Adjust the filters and search again." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchLink: { color: '#1e40af', fontWeight: '700', fontSize: 13, marginTop: spacing.sm },
  tokenBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  token: { ...typography.mono, color: '#0f172a' },
});
