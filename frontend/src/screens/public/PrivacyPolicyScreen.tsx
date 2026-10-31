import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  PolicyBullet,
  PolicyCallout,
  PolicyContact,
  PolicyIntro,
  PolicyLink,
  PolicyPage,
  PolicyParagraph,
  PolicySection,
  PolicyStrong,
} from '../../components/policy';
import type { PublicStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<PublicStackParamList, 'PrivacyPolicy'>;

const DATA_TABLE = [
  {
    category: 'Identity & account',
    examples: 'Name, PAN (as identity marker), mobile number, email',
    purpose: 'Account creation, OTP authentication, communication',
  },
  {
    category: 'Business data (Listing Businesses)',
    examples:
      'Business name, entity type, registration number, sector, location, 36-month turnover, financial statements, liabilities, funding ask, contact details, pitch video',
    purpose: 'To create and display the listing',
  },
  {
    category: 'Payment data',
    examples: 'Transaction IDs, payment status (processed by Razorpay)',
    purpose: 'To process listing/membership fees and issue GST invoices',
  },
  {
    category: 'Technical data',
    examples: 'IP address, browser type, device, access timestamps',
    purpose: 'Security, audit logs, fraud prevention',
  },
  {
    category: 'Usage data',
    examples: 'Pages viewed, listings accessed, downloads, reports filed',
    purpose: 'Operating the Platform and enforcing limits (e.g. 5-download cap)',
  },
];

export default function PrivacyPolicyScreen({ navigation }: Props) {
  return (
    <PolicyPage
      title="Privacy policy"
      updated="31 October 2026"
      onBack={() => navigation.goBack()}
    >
      <PolicyIntro>
        This Privacy Policy explains how <PolicyStrong>Jaspal Singh &amp; Associates</PolicyStrong>{' '}
        (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), operating{' '}
        <PolicyStrong>dataofbusiness.in</PolicyStrong> (the &quot;Platform&quot;), collects, uses,
        stores, shares, and protects your personal data. We are committed to handling your data in
        accordance with India&apos;s{' '}
        <PolicyStrong>Digital Personal Data Protection Act, 2023 (DPDP Act)</PolicyStrong> and the
        Information Technology Act, 2000. By using the Platform, you consent to the practices
        described here.
      </PolicyIntro>

      <PolicySection title="1. Data we collect">
        <View style={styles.tableCard}>
          {DATA_TABLE.map((row, index) => (
            <View
              key={row.category}
              style={[styles.tableRow, index > 0 ? styles.tableRowBorder : null]}
            >
              <Text style={styles.tableCategory}>{row.category}</Text>
              <Text style={styles.tableLine}>
                <Text style={styles.tableLabel}>Examples: </Text>
                {row.examples}
              </Text>
              <Text style={styles.tableLine}>
                <Text style={styles.tableLabel}>Why we collect it: </Text>
                {row.purpose}
              </Text>
            </View>
          ))}
        </View>
        <PolicyCallout>
          <PolicyStrong>What we do NOT collect:</PolicyStrong> We never collect or store login
          credentials, passwords, or access tokens for any government portal — including the Income
          Tax e-filing portal, the GST portal, or the MCA portal. We do not collect your card or bank
          account numbers (these are handled directly by our payment gateway). We do not collect
          sensitive personal data such as biometric, health, caste, or religious information.
        </PolicyCallout>
      </PolicySection>

      <PolicySection title="2. How we use your data">
        <PolicyBullet>To create, verify, and operate your account and listings.</PolicyBullet>
        <PolicyBullet>
          To display Listing Business data in <PolicyStrong>anonymized form</PolicyStrong> publicly,
          and full form to active paying members.
        </PolicyBullet>
        <PolicyBullet>To process payments and issue tax invoices.</PolicyBullet>
        <PolicyBullet>To authenticate logins via OTP.</PolicyBullet>
        <PolicyBullet>To verify data accuracy and investigate reports of incorrect data.</PolicyBullet>
        <PolicyBullet>To maintain security audit logs.</PolicyBullet>
        <PolicyBullet>
          To communicate service-related notices (we do not send unsolicited marketing without
          consent).
        </PolicyBullet>
      </PolicySection>

      <PolicySection title="3. Consent and purpose limitation">
        <PolicyParagraph>
          We collect and process your data only for the purposes stated above and only with your
          consent, which you provide when you register and submit information. We will not use your
          data for any new, incompatible purpose without seeking fresh consent. You may withdraw
          consent at any time (see Section 7), subject to legal retention requirements.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="4. How we share data">
        <PolicyParagraph>We share your data only as follows:</PolicyParagraph>
        <PolicyBullet lead="With Investors:">
          A Listing Business&apos;s identity, financials, and contact details are revealed only to
          Investors holding an active paid membership, as the core function of the Platform and with
          the Listing Business&apos;s explicit consent at listing.
        </PolicyBullet>
        <PolicyBullet lead="With service providers:">
          Payment gateway (Razorpay), SMS/OTP provider, and hosting provider — only as needed to
          operate the Platform, under confidentiality obligations.
        </PolicyBullet>
        <PolicyBullet lead="As required by law:">
          If compelled by a valid legal order from a court or government authority.
        </PolicyBullet>
        <PolicyParagraph>
          We <PolicyStrong>do not sell</PolicyStrong> your personal data to advertisers or third
          parties.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="5. Data storage and security">
        <PolicyParagraph>
          Your data is stored on secure servers in India. We implement reasonable security safeguards
          including: HTTPS/SSL encryption, hashed storage of one-time passwords, document storage in
          non-public directories accessible only through authenticated requests, time-limited access
          links, rate limiting, and access audit logging. While we take these measures, no system is
          completely secure, and we cannot guarantee absolute security.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="6. Data retention">
        <PolicyParagraph>
          We retain your data for as long as your account is active and as required to provide the
          service. After account closure, we retain certain data only as long as necessary to comply
          with legal, tax, and accounting obligations, after which it is deleted or anonymized.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="7. Your rights under the DPDP Act">
        <PolicyParagraph>As a Data Principal, you have the right to:</PolicyParagraph>
        <PolicyBullet lead="Access">the personal data we hold about you.</PolicyBullet>
        <PolicyBullet lead="Correct">inaccurate or incomplete data.</PolicyBullet>
        <PolicyBullet lead="Erase">your data, subject to legal retention requirements.</PolicyBullet>
        <PolicyBullet lead="Withdraw consent">to processing.</PolicyBullet>
        <PolicyBullet lead="Grievance redressal">
          — to raise complaints with our Grievance Officer.
        </PolicyBullet>
        <PolicyBullet lead="Nominate">
          another individual to exercise your rights in case of death or incapacity.
        </PolicyBullet>
        <PolicyParagraph>
          To exercise any right, contact our Grievance Officer (Section 9). We will respond within
          the timeframes prescribed by law.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="8. Cookies">
        <PolicyParagraph>
          We use only essential cookies and local browser storage necessary to keep you logged in and
          operate the Platform. We do not use third-party advertising or tracking cookies for
          behavioural profiling. If we deploy analytics in future, we will update this policy and
          seek consent where required.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="9. Grievance Officer">
        <PolicyParagraph>
          In accordance with the DPDP Act and the IT Act, our Grievance Officer is:
        </PolicyParagraph>
        <PolicyContact
          lines={[
            'Grievance Officer',
            'Email: grievance@dataofbusiness.in',
            'Address: Registered office, Delhi',
            'Response time: We acknowledge complaints within 24 hours and resolve them within the period prescribed under applicable law.',
          ]}
        />
        <PolicyParagraph>
          See our{' '}
          <PolicyLink onPress={() => navigation.navigate('Grievance')}>
            Grievance Redressal page
          </PolicyLink>{' '}
          for the full procedure.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="10. Children">
        <PolicyParagraph>
          The Platform is not intended for individuals under 18. We do not knowingly collect data
          from minors.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="11. Changes to this policy">
        <PolicyParagraph>
          We may update this Privacy Policy from time to time. Material changes will be notified on
          the Platform with a revised &quot;last updated&quot; date.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="12. Contact">
        <PolicyContact
          lines={[
            'Jaspal Singh & Associates',
            'Registered office, Delhi',
            'Email: support@dataofbusiness.in',
          ]}
        />
      </PolicySection>
    </PolicyPage>
  );
}

// ------------------------------------------------------------------ styles

const styles = StyleSheet.create({
  tableCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  tableRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  tableRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tableCategory: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  tableLine: {
    ...typography.body,
    lineHeight: 21,
    color: '#2C3550',
  },
  tableLabel: { fontWeight: '700', color: colors.text },
});
