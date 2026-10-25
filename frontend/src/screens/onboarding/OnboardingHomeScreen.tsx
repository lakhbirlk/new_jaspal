import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchStatus, submitForReview } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { ProfileCompletionCard } from '../../components/ProfileCompletionCard';
import {
  Badge,
  Banner,
  Button,
  Card,
  Muted,
  Screen,
} from '../../components/ui';
import type { OnboardingStackParamList } from '../../navigation/types';
import { formatDateTime, roleLabel, statusTone, titleCase } from '../../lib/format';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingHome'>;

export default function OnboardingHomeScreen({ navigation }: Props) {
  const { user, me, refreshMe, signOut, busy } = useAuth();
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus()
      .then((status) => {
        setReviewNote(status.reviewNote ?? null);
        setSubmittedAt(status.submittedAt ?? null);
      })
      .catch(() => undefined);
  }, [user?.status]);

  if (!user) return null;
  const completion = me?.profileCompletion;
  const pendingReview = user.status === 'pending_review';
  const isBusiness = user.role === 'business';

  const submit = async () => {
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const response = await submitForReview();
      setMessage(response.message);
      await refreshMe();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>{roleLabel(user.role)} onboarding</Text>
        <Text style={styles.heroTitle}>
          {pendingReview ? 'Your profile is under review' : 'Finish setting up your profile'}
        </Text>
        <Text style={styles.heroSubtitle}>
          {pendingReview
            ? 'An administrator will review your details and documents. You can sign back in to check progress.'
            : 'Complete the required fields and upload your documents, then submit your profile for administrator review.'}
        </Text>
        <View style={styles.badgeRow}>
          <Badge label={titleCase(user.status)} tone={statusTone(user.status)} />
          {submittedAt ? <Muted style={{ color: '#d7e2ff' }}>Submitted {formatDateTime(submittedAt)}</Muted> : null}
        </View>
      </View>

      {reviewNote ? <Banner tone="warning" message={`Reviewer note: ${reviewNote}`} /> : null}
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} /> : null}

      {!pendingReview ? <ProfileCompletionCard completion={completion} /> : null}

      {!pendingReview ? (
        <Card>
          <Text style={typography.h3}>
            {isBusiness ? 'Business details and documents' : 'Profile details and documents'}
          </Text>
          <Muted style={{ marginTop: spacing.xs }}>
            You can save progress at any time. Submission is available once every required item is
            present.
          </Muted>
          <View style={styles.actions}>
            <Button
              title={isBusiness ? 'Edit business details' : 'Edit researcher profile'}
              onPress={() => navigation.navigate(isBusiness ? 'BusinessEdit' : 'ResearcherProfileEdit')}
              style={styles.action}
            />
            <Button
              title="Manage documents"
              variant="secondary"
              onPress={() => navigation.navigate('Documents')}
              style={styles.action}
            />
          </View>
        </Card>
      ) : null}

      {!pendingReview ? (
        <Card>
          <Text style={typography.h3}>Submit for review</Text>
          <Muted style={{ marginTop: spacing.xs }}>
            {completion?.complete
              ? 'Everything required is present. Submit your profile for administrator approval.'
              : 'Complete the missing items above to enable submission.'}
          </Muted>
          <Button
            title="Submit profile for review"
            onPress={submit}
            loading={submitting}
            disabled={!completion?.complete || submitting}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : (
        <Card style={{ backgroundColor: colors.surfaceMuted }}>
          <Text style={typography.h3}>What happens next?</Text>
          <Muted style={{ marginTop: spacing.xs }}>
            Administrators review profiles and documents in the control panel. After approval you
            get full access to your role workspace and will be able to sign in normally.
          </Muted>
        </Card>
      )}

      <View style={styles.actions}>
        <Button
          title="Account and security"
          variant="secondary"
          onPress={() => navigation.navigate('Account')}
          style={styles.action}
        />
        <Button
          title="Sign out"
          variant="ghost"
          onPress={() => { void signOut(); }}
          loading={busy}
          style={styles.action}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primaryDark,
    borderRadius: 16,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  heroEyebrow: { color: '#a9c0ff', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { color: colors.white, fontSize: 24, fontWeight: '800', marginTop: spacing.sm },
  heroSubtitle: { color: '#d7e2ff', fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  action: { flexGrow: 1, minWidth: 160 },
});
