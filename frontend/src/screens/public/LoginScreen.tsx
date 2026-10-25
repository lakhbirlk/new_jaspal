import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { Banner, Button, Card, Field, Screen, Title } from '../../components/ui';
import type { PublicStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<PublicStackParamList, 'Login'>;

const demoAccounts = [
  { label: 'Researcher', email: 'researcher@directory.local', password: 'Demo@12345' },
  { label: 'Business', email: 'business@directory.local', password: 'Demo@12345' },
  { label: 'Auditor', email: 'auditor@directory.local', password: 'Demo@12345' },
  { label: 'Admin', email: 'admin@directory.local', password: 'Admin@12345' },
];

export default function LoginScreen({ navigation }: Props) {
  const { login, busy, lastError, clearError, phase } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [awaitingSession, setAwaitingSession] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (phase === 'authenticated' || phase === 'mfa' || phase === 'mfa_setup') {
      setAwaitingSession(false);
    }
  }, [phase]);

  const submit = async () => {
    setLocalError(null);
    clearError();
    if (!email.trim() || !password) {
      setLocalError('Enter your email address and password.');
      return;
    }
    setAwaitingSession(true);
    try {
      await login(email.trim(), password);
    } catch {
      setAwaitingSession(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Sign in to continue to your role-based workspace.">Welcome back</Title>

      {localError || lastError ? (
        <Banner message={localError ?? lastError ?? ''} onDismiss={() => {
          setLocalError(null);
          clearError();
        }} />
      ) : null}

      <Card>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@company.com"
          required
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Your password"
          required
          onSubmitEditing={submit}
        />
        <Button
          title="Sign in"
          onPress={submit}
          loading={busy && awaitingSession}
          disabled={busy}
        />
        <View style={styles.links}>
          <Pressable accessibilityRole="link" onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>Create an account</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => navigation.navigate('AcceptInvite')}
          style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
        >
          <Text style={styles.link}>Have an invitation? Accept it</Text>
        </Pressable>
      </Card>

      <Card style={{ backgroundColor: colors.surfaceMuted }}>
        <Text style={typography.h3}>Demo accounts</Text>
        <Text style={[typography.small, { marginTop: spacing.xs, marginBottom: spacing.sm }]}>
          Tap a role to fill the form. Use the password shown after the email.
        </Text>
        <View style={styles.demoWrap}>
          {demoAccounts.map((account) => (
            <Pressable
              key={account.email}
              accessibilityRole="button"
              accessibilityLabel={`Fill the form with the ${account.label} demo account`}
              onPress={() => {
                setEmail(account.email);
                setPassword(account.password);
              }}
              style={styles.demoChip}
            >
              <Text style={styles.demoChipText}>{account.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Pressable
        accessibilityRole="link"
        onPress={() => navigation.navigate('Landing')}
        style={{ alignSelf: 'center', marginTop: spacing.sm }}
      >
        <Text style={styles.link}>Back to home</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, gap: spacing.sm },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  demoWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  demoChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  demoChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
