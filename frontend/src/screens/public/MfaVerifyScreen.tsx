import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { Banner, Button, Card, Field, Screen, Title } from '../../components/ui';
import { spacing, typography } from '../../theme';

export default function MfaVerifyScreen() {
  const { pending, verifyMfaCode, cancelChallenge, busy, lastError, clearError } = useAuth();
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const submit = async () => {
    setLocalError(null);
    if (code.trim().length < 6) {
      setLocalError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    try {
      await verifyMfaCode(code);
    } catch {
      // Error is surfaced by the auth context.
    }
  };

  return (
    <Screen>
      <Title subtitle={`Two-factor authentication is required for ${pending?.email ?? 'this account'}.`}>
        Enter your authenticator code
      </Title>
      {localError || lastError ? (
        <Banner message={localError ?? lastError ?? ''} onDismiss={() => {
          setLocalError(null);
          clearError();
        }} />
      ) : null}
      <Card>
        <Field
          label="6-digit code"
          value={code}
          onChangeText={(value) => setCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="numeric"
          maxLength={6}
          placeholder="000000"
          autoComplete="one-time-code"
          style={styles.codeInput}
          required
          onSubmitEditing={submit}
        />
        <Button title="Verify and sign in" onPress={submit} loading={busy} disabled={busy} />
        <Button
          title="Cancel"
          variant="ghost"
          onPress={cancelChallenge}
          style={{ marginTop: spacing.sm }}
        />
      </Card>
      <Text style={[typography.small, { textAlign: 'center' }]}>
        Codes refresh every 30 seconds. Check your device clock if the code is rejected.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
});
