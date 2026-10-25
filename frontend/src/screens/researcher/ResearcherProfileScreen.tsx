import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { fetchProfile, updateResearcherProfile } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { Completion } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ProfileCompletionCard } from '../../components/ProfileCompletionCard';
import { Badge, Banner, Button, Card, Field, Loading, Screen, Title } from '../../components/ui';
import { statusTone, titleCase } from '../../lib/format';
import { spacing, typography } from '../../theme';

interface Values {
  fullName: string;
  organization: string;
  designation: string;
  phone: string;
  purposeOfResearch: string;
}

export default function ResearcherProfileScreen({
  showAccountLink = false,
  topInset = true,
}: {
  showAccountLink?: boolean;
  topInset?: boolean;
}) {
  const { user, me, refreshMe } = useAuth();
  const navigation = useNavigation<NavigationProp<Record<string, object | undefined>>>();
  const [values, setValues] = useState<Values>({
    fullName: user?.fullName ?? '',
    organization: '',
    designation: '',
    phone: '',
    purposeOfResearch: '',
  });
  const [completion, setCompletion] = useState<Completion | null>(me?.profileCompletion ?? null);
  const [status, setStatus] = useState(user?.status ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchProfile()
      .then((response) => {
        if (!active) return;
        const profile = response.profile;
        setValues({
          fullName: profile?.fullName ?? response.user.fullName ?? '',
          organization: profile?.organization ?? '',
          designation: profile?.designation ?? '',
          phone: profile?.phone ?? '',
          purposeOfResearch: profile?.purposeOfResearch ?? '',
        });
        setCompletion(response.completion);
        setStatus(response.user.status);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const editable = status !== 'pending_review' && status !== 'suspended';

  const save = async () => {
    setError(null);
    setMessage(null);
    if (!values.fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    setSaving(true);
    try {
      const response = await updateResearcherProfile({
        fullName: values.fullName.trim(),
        organization: values.organization,
        designation: values.designation,
        phone: values.phone,
        purposeOfResearch: values.purposeOfResearch,
      });
      setCompletion(response.completion);
      setMessage('Profile saved.');
      await refreshMe();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const change = (key: keyof Values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <Screen topInset={topInset}>
      <Title subtitle="This information is shared with administrators during review.">
        Researcher profile
      </Title>

      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} /> : null}

      <Card>
        <View style={styles.statusRow}>
          <Text style={typography.h3}>Account status</Text>
          <Badge label={titleCase(status)} tone={statusTone(status)} />
        </View>
        {status === 'pending_review' ? (
          <Text style={[typography.small, { marginTop: spacing.sm }]}>
            Your profile is under review and is temporarily read-only. You will be notified when an
            administrator approves it.
          </Text>
        ) : null}
      </Card>

      <ProfileCompletionCard completion={completion} />

      {loading ? <Loading /> : (
        <Card>
          <Field
            label="Full name"
            value={values.fullName}
            onChangeText={change('fullName')}
            editable={editable}
            required
          />
          <Field
            label="Organization"
            value={values.organization}
            onChangeText={change('organization')}
            editable={editable}
            placeholder="Research institute or company"
            required
          />
          <Field
            label="Designation"
            value={values.designation}
            onChangeText={change('designation')}
            editable={editable}
            placeholder="Research analyst"
            required
          />
          <Field
            label="Phone"
            value={values.phone}
            onChangeText={change('phone')}
            keyboardType="phone-pad"
            editable={editable}
            placeholder="+91 90000 00000"
            required
          />
          <Field
            label="Purpose of research"
            value={values.purposeOfResearch}
            onChangeText={change('purposeOfResearch')}
            editable={editable}
            multiline
            placeholder="What will you research in this directory?"
            required
          />
          <Button
            title="Save profile"
            onPress={save}
            loading={saving}
            disabled={!editable || saving}
          />
          {showAccountLink ? (
            <Button
              title="Account and security"
              variant="ghost"
              onPress={() => navigation.navigate('Account' as never)}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
