import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { API_BASE, errorMessage } from '../../api/client';
import { roleLabel, statusTone, titleCase } from '../../lib/format';
import { colors, spacing, typography } from '../../theme';
import { ProfileCompletionCard } from '../../components/ProfileCompletionCard';
import {
  Badge,
  Banner,
  Button,
  Card,
  Field,
  KeyValue,
  Muted,
  Screen,
  SectionTitle,
  Title,
} from '../../components/ui';

export default function AccountScreen() {
  const {
    user,
    me,
    refreshMe,
    signOut,
    busy,
    beginMfaSetup,
    enableMfaCode,
    lastError,
    clearError,
  } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);

  if (!user) return null;

  const refresh = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      await refreshMe();
      setMessage('Account refreshed.');
    } catch (cause) {
      setMfaError(errorMessage(cause));
    } finally {
      setRefreshing(false);
    }
  };

  const startMfa = async () => {
    setMfaError(null);
    setMfaBusy(true);
    try {
      setMfaSetup(await beginMfaSetup());
    } catch (cause) {
      setMfaError(errorMessage(cause));
    } finally {
      setMfaBusy(false);
    }
  };

  const confirmMfa = async () => {
    setMfaError(null);
    setMfaBusy(true);
    try {
      await enableMfaCode(mfaCode);
      setMfaSetup(null);
      setMfaCode('');
      setMessage('Two-factor authentication enabled.');
    } catch (cause) {
      setMfaError(errorMessage(cause));
    } finally {
      setMfaBusy(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Your account, security settings, and session.">Account</Title>
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}
      {mfaError || lastError ? (
        <Banner message={mfaError ?? lastError ?? ''} onDismiss={() => {
          setMfaError(null);
          clearError();
        }} />
      ) : null}

      <Card>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user.fullName || user.email).slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={typography.h2}>{user.fullName || 'Unnamed user'}</Text>
            <Text style={typography.small}>{user.email}</Text>
          </View>
          <Badge label={titleCase(user.status)} tone={statusTone(user.status)} />
        </View>
        <View style={{ marginTop: spacing.md }}>
          <KeyValue label="Role" value={roleLabel(user.role)} />
          <KeyValue label="Email verified" value={user.emailVerified ? 'Yes' : 'No'} />
          <KeyValue label="Two-factor" value={user.mfaEnabled ? 'Enabled' : 'Not enabled'} />
          {me?.permissions ? <KeyValue label="Permissions" value={`${me.permissions.length} granted`} /> : null}
          {me?.businessId ? <KeyValue label="Business ID" value={me.businessId} mono /> : null}
        </View>
        <View style={styles.actions}>
          <Button title="Refresh account" variant="secondary" onPress={refresh} loading={refreshing} />
        </View>
      </Card>

      {(user.role === 'researcher' || user.role === 'business') && me?.profileCompletion ? (
        <ProfileCompletionCard completion={me.profileCompletion} />
      ) : null}

      {!user.mfaEnabled ? (
        <Card>
          <SectionTitle>Two-factor authentication</SectionTitle>
          {!mfaSetup ? (
            <>
              <Muted style={{ marginBottom: spacing.md }}>
                Add a second factor to protect your account. Recommended for every role and required
                for administrators and auditors.
              </Muted>
              <Button title="Set up authenticator" onPress={startMfa} loading={mfaBusy} />
            </>
          ) : (
            <>
              <Text style={typography.small}>Add this key to your authenticator app:</Text>
              <View style={styles.secretBox}>
                <Text selectable style={styles.secret}>{mfaSetup.secret}</Text>
              </View>
              <Muted style={{ marginTop: spacing.xs }}>{mfaSetup.otpauthUri}</Muted>
              <View style={{ height: spacing.md }} />
              <Field
                label="Authenticator code"
                value={mfaCode}
                onChangeText={(value) => setMfaCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="numeric"
                maxLength={6}
                placeholder="000000"
              />
              <Button title="Enable two-factor" onPress={confirmMfa} loading={mfaBusy} disabled={mfaCode.length < 6} />
            </>
          )}
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Session</SectionTitle>
        <Muted>
          Tokens are stored in secure device storage. Signing out revokes the refresh token on the
          server.
        </Muted>
        <Muted style={{ marginTop: spacing.xs }}>API: {API_BASE || 'same origin'}</Muted>
        <Muted style={{ marginTop: spacing.xs }}>
          Signed in as {user.email}
        </Muted>
        <Button
          title="Sign out"
          variant="danger"
          onPress={() => { void signOut(); }}
          loading={busy}
          style={{ marginTop: spacing.md }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primaryDark, fontWeight: '800', fontSize: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  secretBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  secret: { fontFamily: 'monospace', fontSize: 15, letterSpacing: 1.5 },
});
