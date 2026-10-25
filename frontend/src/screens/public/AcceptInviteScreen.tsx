import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { errorMessage } from '../../api/client';
import { Banner, Button, Card, Field, Screen, Title } from '../../components/ui';
import type { PublicStackParamList } from '../../navigation/types';
import { typography } from '../../theme';

type Props = NativeStackScreenProps<PublicStackParamList, 'AcceptInvite'>;

export default function AcceptInviteScreen({ route }: Props) {
  const { acceptInvitation, busy } = useAuth();
  const [token, setToken] = useState(route.params?.token ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!token.trim()) {
      setError('Enter the invitation token from your email.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    try {
      await acceptInvitation(token, password);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  return (
    <Screen>
      <Title subtitle="Set a password to activate the account an administrator created for you.">
        Accept your invitation
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      <Card>
        <Field
          label="Invitation token"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          placeholder="Paste your invitation token"
          required
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 10 characters"
          hint="At least 10 characters, including a letter and a number."
          required
        />
        <Field
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="Repeat the password"
          required
        />
        <Button title="Activate account" onPress={submit} loading={busy} disabled={busy} />
      </Card>
      <View style={{ alignItems: 'center' }}>
        <Text style={typography.small}>
          Auditors will be asked to enrol MFA after signing in.
        </Text>
      </View>
    </Screen>
  );
}
