import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  PolicyContactCard,
  PolicyLink,
  PolicyNumberedList,
  PolicyPage,
  PolicyParagraph,
  PolicySection,
  PolicyStrong,
} from '../../components/policy';
import type { PublicStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<PublicStackParamList, 'Grievance'>;

export default function GrievanceScreen({ navigation }: Props) {
  return (
    <PolicyPage
      title="Grievance redressal & contact"
      updated="31 October 2026"
      onBack={() => navigation.goBack()}
    >
      <View style={styles.introWrap}>
        <PolicyParagraph>
          We take user grievances seriously. In accordance with the Information Technology Act,
          2000, the Consumer Protection Act, 2019, and the Digital Personal Data Protection Act,
          2023, we provide the following grievance redressal mechanism and contact details.
        </PolicyParagraph>
      </View>

      <PolicySection title="Grievance Officer">
        <PolicyContactCard
          title="Designated Grievance Officer"
          rows={[
            { label: 'Email', value: 'grievance@dataofbusiness.in' },
            { label: 'Address', value: 'Registered office, Delhi' },
            { label: 'Working hours', value: 'Monday–Friday, 10:00 AM – 6:00 PM IST' },
          ]}
        />
      </PolicySection>

      <PolicySection title="How to raise a grievance">
        <PolicyNumberedList
          items={[
            'Email the Grievance Officer with your registered name, mobile number, and a clear description of your complaint.',
            'Include any relevant payment ID, listing code, or screenshots.',
            <>
              We will acknowledge your complaint within{' '}
              <PolicyStrong>24 hours</PolicyStrong>.
            </>,
            'We will investigate and resolve the matter within the timeframe prescribed under applicable law (and in any case as expeditiously as possible).',
            'You will receive a written resolution to your registered email.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Reporting incorrect listing data">
        <PolicyParagraph>
          Investors can report a listing they believe contains incorrect or misleading data directly
          from the listing page using the &quot;Report&quot; feature, or by emailing the Grievance
          Officer. Verified incorrect listings are removed, the responsible account may be suspended,
          and affected download slots are restored automatically.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="Reporting data privacy concerns">
        <PolicyParagraph>
          For any concern regarding your personal data — access, correction, erasure, or consent
          withdrawal — contact our Grievance Officer. Your rights under the DPDP Act are described in
          our{' '}
          <PolicyLink onPress={() => navigation.navigate('PrivacyPolicy')}>
            Privacy Policy
          </PolicyLink>
          .
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="General contact">
        <PolicyContactCard
          title="Business / Operator Details"
          rows={[
            { label: 'Operated by', value: 'Jaspal Singh & Associates' },
            { label: 'Registered office', value: 'Delhi' },
            { label: 'Support email', value: 'support@dataofbusiness.in' },
          ]}
        />
      </PolicySection>

      <Text style={styles.note}>
        For terms governing use of the Platform, see our{' '}
        <PolicyLink onPress={() => navigation.navigate('TermsOfService')}>
          Terms of Service
        </PolicyLink>
        . For refund queries, see our{' '}
        <PolicyLink onPress={() => navigation.navigate('RefundPolicy')}>Refund Policy</PolicyLink>.
      </Text>
    </PolicyPage>
  );
}

// ------------------------------------------------------------------ styles

const styles = StyleSheet.create({
  introWrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  note: {
    ...typography.bodyMuted,
    color: colors.muted,
    marginBottom: spacing.md,
  },
});
