import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { resetPassword } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { Banner, Button, Card, Field, Screen, Title } from '../../components/ui';
import type { PublicStackParamList } from '../../navigation/types';
import { spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<PublicStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const [token, setToken] = useState(route.params?.token ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (!token.trim()) {
      setError('Enter the reset token from your email.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token.trim(), password);
      setDone(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Choose a new password. All existing sessions will be signed out.">
        Set a new password
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {done ? (
        <Card>
          <Text style={typography.h3}>Password updated</Text>
          <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
            You can now sign in with your new password.
          </Text>
          <Button
            title="Go to sign in"
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : (
        <Card>
          <Field
            label="Reset token"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            placeholder="Paste your reset token"
            required
          />
          <Field
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 10 characters"
            hint="At least 10 characters, including a letter and a number."
            required
          />
          <Field
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            placeholder="Repeat the new password"
            required
          />
          <Button title="Update password" onPress={submit} loading={busy} disabled={busy} />
        </Card>
      )}
      <View style={styles.footer}>
        <Pressable accessibilityRole="link" onPress={() => navigation.navigate('Login')}>
          <Text style={typography.small}>Back to sign in</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', marginTop: spacing.md },
});
