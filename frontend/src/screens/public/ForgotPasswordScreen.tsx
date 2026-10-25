import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { forgotPassword } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { Banner, Button, Card, Field, Screen, Title } from '../../components/ui';
import type { PublicStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<PublicStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setMessage(null);
    if (!email.trim()) {
      setError('Enter the email address for your account.');
      return;
    }
    setBusy(true);
    try {
      const response = await forgotPassword(email.trim());
      setMessage(response.message);
      if (response.devResetToken) {
        setDevToken(response.devResetToken);
        navigation.navigate('ResetPassword', { token: response.devResetToken });
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="We will send a one-time reset link if the account exists.">
        Reset your password
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} /> : null}

      <Card>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@company.com"
          required
        />
        <Button title="Send reset link" onPress={submit} loading={busy} disabled={busy} />
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Pressable accessibilityRole="link" onPress={() => navigation.navigate('ResetPassword')}>
            <Text style={styles.link}>I already have a reset token</Text>
          </Pressable>
          {devToken ? <Text style={typography.small}>Development token: {devToken}</Text> : null}
        </View>
      </Card>
    </Screen>
  );
}

const styles = {
  link: { color: colors.primary, fontWeight: '600' as const, fontSize: 13 },
};
