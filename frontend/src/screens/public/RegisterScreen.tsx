import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { errorMessage } from '../../api/client';
import { Banner, Button, Card, ChoiceRow, Field, Screen, Title } from '../../components/ui';
import type { PublicStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<PublicStackParamList, 'Register'>;

export default function RegisterScreen({ navigation, route }: Props) {
  const { signUp, busy } = useAuth();
  const [role, setRole] = useState<'researcher' | 'business'>(route.params?.role ?? 'researcher');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Full name, email, and password are required.');
      return;
    }
    if (role === 'business' && !businessName.trim()) {
      setError('Enter the legal name of your business.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    try {
      const result = await signUp({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        role,
        businessName: role === 'business' ? businessName.trim() : undefined,
      });
      navigation.navigate('VerifyEmail', {
        email: email.trim(),
        token: result.devVerificationToken,
      });
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  return (
    <Screen>
      <Title subtitle="Choose how you will use the directory. Business and researcher accounts are reviewed by an administrator.">
        Create your account
      </Title>

      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}

      <Card>
        <ChoiceRow
          label="I am a"
          value={role}
          onChange={(value) => setRole(value as 'researcher' | 'business')}
          options={[
            { value: 'researcher', label: 'Researcher' },
            { value: 'business', label: 'Business owner' },
          ]}
        />
        <Field
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your full name"
          required
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@company.com"
          required
        />
        {role === 'business' ? (
          <Field
            label="Business legal name"
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Acme Supplies Private Limited"
            required
          />
        ) : null}
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 10 characters"
          hint="Use at least 10 characters, including a letter and a number."
          required
        />
        <Field
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="Repeat your password"
          required
        />
        <Button title="Create account" onPress={submit} loading={busy} disabled={busy} />
      </Card>

      <View style={styles.footer}>
        <Text style={typography.bodyMuted}>Already registered?</Text>
        <Pressable accessibilityRole="link" onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Sign in</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.sm },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
