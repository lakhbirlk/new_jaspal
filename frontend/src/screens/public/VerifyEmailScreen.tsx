import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { verifyEmail } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { Banner, Button, Card, Field, Screen, Title } from '../../components/ui';
import type { PublicStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<PublicStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const [token, setToken] = useState(route.params?.token ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState(
    route.params?.token ? 'A development verification token was filled in for you.' : '',
  );

  const submit = async () => {
    setError(null);
    if (!token.trim()) {
      setError('Enter the verification token from your email.');
      return;
    }
    setBusy(true);
    try {
      const result = await verifyEmail(token.trim());
      setVerified(true);
      setMessage(result.message);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Verify your email address to start completing your profile.">
        Verify your email
      </Title>

      {route.params?.email ? (
        <Card style={{ backgroundColor: colors.surfaceMuted }}>
          <Text style={typography.body}>
            We sent a verification message to <Text style={{ fontWeight: '700' }}>{route.params.email}</Text>.
          </Text>
          {route.params.token ? (
            <Text style={[typography.small, { marginTop: spacing.xs }]}>
              Development mode exposes the token here; in production it arrives by email.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {verified ? <Banner tone="success" message={message || 'Your email is verified.'} /> : null}

      {!verified ? (
        <Card>
          <Field
            label="Verification token"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            placeholder="Paste the token from your email"
            required
          />
          <Button title="Verify email" onPress={submit} loading={busy} disabled={busy} />
        </Card>
      ) : (
        <Card>
          <Text style={typography.body}>
            Your email is verified. Sign in to complete your profile and submit it for review.
          </Text>
          <Button
            title="Continue to sign in"
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: spacing.md }}
          />
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
