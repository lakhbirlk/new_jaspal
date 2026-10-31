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

type Props = NativeStackScreenProps<PublicStackParamList, 'TermsOfService'>;

const FEES = [
  {
    fee: 'Business listing fee',
    amount: '₹500 per year of financial data listed, plus applicable GST',
  },
  {
    fee: 'Investor membership',
    amount: '₹2,500 for 90 days, plus applicable GST (₹2,950 total)',
  },
];

export default function TermsOfServiceScreen({ navigation }: Props) {
  return (
    <PolicyPage
      title="Terms of Service"
      updated="31 October 2026 · Effective immediately upon use"
      onBack={() => navigation.goBack()}
    >
      <PolicyIntro>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of the website{' '}
        <PolicyStrong>dataofbusiness.in</PolicyStrong> and all related services (the
        &quot;Platform&quot;), operated by <PolicyStrong>Jaspal Singh &amp; Associates</PolicyStrong>{' '}
        (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By accessing, registering on, or using the
        Platform, you agree to be bound by these Terms. If you do not agree, you must not use the
        Platform.
      </PolicyIntro>

      <PolicySection title="1. Nature of the Platform — Important">
        <PolicyParagraph>
          DataOfBusiness.in is an <PolicyStrong>information and research platform only</PolicyStrong>
          . We provide a venue where private Indian businesses (&quot;Listing Businesses&quot;) can
          publish anonymized financial information, and where registered members
          (&quot;Investors&quot;) can access that information for research and due-diligence
          purposes.
        </PolicyParagraph>
        <PolicyCallout>
          <PolicyStrong>We are NOT</PolicyStrong> a stock exchange, a broker, a depository, an
          investment adviser, a research analyst, a portfolio manager, a peer-to-peer (P2P) lending
          platform, a non-banking financial company (NBFC), or any intermediary regulated under the
          SEBI Act 1992, the Securities Contracts (Regulation) Act 1956, the SEBI (Investment
          Advisers) Regulations 2013, or the Reserve Bank of India&apos;s NBFC-P2P Directions. We do
          not solicit investments, recommend any business, broker any transaction, facilitate any
          lending or funding, hold or transfer any funds between parties, or guarantee any outcome.
        </PolicyCallout>
        <PolicyParagraph>
          Any decision to invest in, lend to, or transact with any Listing Business is made{' '}
          <PolicyStrong>
            solely by you, at your own discretion and risk, entirely outside the Platform.
          </PolicyStrong>{' '}
          We are not a party to and bear no responsibility for any such transaction.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="2. Eligibility">
        <PolicyBullet>
          You must be a resident of India as defined under the Foreign Exchange Management Act, 1999
          (FEMA).
        </PolicyBullet>
        <PolicyBullet>
          You must be at least 18 years of age and competent to contract under the Indian Contract
          Act, 1872.
        </PolicyBullet>
        <PolicyBullet>
          If registering on behalf of a business, you must be authorised to do so and to bind that
          business.
        </PolicyBullet>
        <PolicyBullet>
          You must register using a valid Permanent Account Number (PAN) and a valid Indian mobile
          number.
        </PolicyBullet>
      </PolicySection>

      <PolicySection title="3. Accounts and authentication">
        <PolicyParagraph>
          Registration requires PAN and mobile-number verification via one-time password (OTP). You
          are responsible for maintaining the confidentiality of your account and for all activity
          under it. We do not collect or store any login credentials for any government portal (such
          as the Income Tax e-filing portal, the GST portal, or the MCA portal), and we will never ask
          you for such credentials. PAN is collected only as an identity marker.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="4. Listing Businesses — obligations and warranties">
        <PolicyParagraph>If you list a business, you represent and warrant that:</PolicyParagraph>
        <PolicyBullet>
          All information you provide — including monthly turnover (excluding GST) for up to 36
          months, financial statements, profile details, loans and liabilities, and your funding ask —
          is <PolicyStrong>true, accurate, current, and not misleading.</PolicyStrong>
        </PolicyBullet>
        <PolicyBullet>
          Any financial statement you upload as &quot;CA-certified&quot; is genuinely certified by a
          Chartered Accountant holding valid membership of the Institute of Chartered Accountants of
          India (ICAI), with a valid UDIN where applicable.
        </PolicyBullet>
        <PolicyBullet>
          You have the legal right and authority to disclose the information you upload.
        </PolicyBullet>
        <PolicyBullet>
          You consent to your information being displayed in{' '}
          <PolicyStrong>anonymized form</PolicyStrong> (identified only by a unique listing code) to
          the public, and to your identity, contact details, and full financials being revealed to
          Investors who hold an active paid membership.
        </PolicyBullet>
        <PolicyParagraph>
          You acknowledge that we verify the format of certain data automatically and review listings
          before they go live, but that such verification is{' '}
          <PolicyStrong>not a guarantee or endorsement</PolicyStrong> of the accuracy of any
          information. Final responsibility for accuracy rests with you.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="5. Investors — access and conduct">
        <PolicyBullet>
          An active paid membership unlocks the identity, full CA-certified financial statements,
          pitch video, and contact details of Listing Businesses.
        </PolicyBullet>
        <PolicyBullet>
          Members may download a{' '}
          <PolicyStrong>maximum of 5 complete business profiles</PolicyStrong> per active membership
          period. If a downloaded listing is later removed for verified incorrect data, that download
          slot is automatically restored.
        </PolicyBullet>
        <PolicyBullet>
          You agree to use accessed information solely for your own research and due diligence, and
          not to scrape, resell, redistribute, or publish it.
        </PolicyBullet>
        <PolicyBullet>
          You acknowledge that information is provided by Listing Businesses and that you must
          conduct your own independent verification before any transaction.
        </PolicyBullet>
      </PolicySection>

      <PolicySection title="6. Fees and payments">
        <View style={styles.feeCard}>
          {FEES.map((row, index) => (
            <View
              key={row.fee}
              style={[styles.feeRow, index > 0 ? styles.feeRowBorder : null]}
            >
              <Text style={styles.feeLabel}>{row.fee}</Text>
              <Text style={styles.feeValue}>{row.amount}</Text>
            </View>
          ))}
        </View>
        <PolicyParagraph>
          All payments are processed through a third-party payment gateway (Razorpay). We do not
          store your card or banking details. All fees are exclusive of, or inclusive of, Goods and
          Services Tax (GST) as indicated at checkout, and GST invoices are issued accordingly. Fees
          may change prospectively with notice on the Platform.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="7. Reporting and removal of incorrect data">
        <PolicyParagraph>
          Investors may report any listing they believe contains incorrect or misleading data.
          Reported listings are reviewed by us. If we determine the data is incorrect, the listing is
          removed, the Listing Business&apos;s account may be suspended, and affected Investors&apos;
          download slots are restored. We act as a neutral reviewer and our determination is final for
          the purpose of Platform access.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="8. Intellectual property">
        <PolicyParagraph>
          The Platform, its design, code, trademarks, and original content are owned by us.
          Information uploaded by Listing Businesses remains theirs; by uploading, they grant us a
          licence to display and process it as described in these Terms. You may not copy, modify, or
          create derivative works of the Platform.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="9. Prohibited conduct">
        <PolicyBullet>Uploading false, fraudulent, or misleading data.</PolicyBullet>
        <PolicyBullet>
          Using the Platform to solicit investments in violation of any law.
        </PolicyBullet>
        <PolicyBullet>Scraping, bulk-downloading, or redistributing Platform data.</PolicyBullet>
        <PolicyBullet>
          Attempting to unmask anonymized listings through unauthorized means.
        </PolicyBullet>
        <PolicyBullet>Any use that violates applicable Indian law.</PolicyBullet>
      </PolicySection>

      <PolicySection title="10. Disclaimer of warranties">
        <PolicyParagraph>
          The Platform and all information on it are provided &quot;as is&quot; and &quot;as
          available&quot;, without warranties of any kind, express or implied, including accuracy,
          completeness, merchantability, or fitness for a particular purpose. We do not warrant that
          any information is accurate or that any business will perform as represented.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="11. Limitation of liability">
        <PolicyParagraph>
          To the maximum extent permitted by law, we shall not be liable for any indirect, incidental,
          consequential, or punitive damages, or for any loss arising from any investment, loan, or
          transaction you enter into with any Listing Business, or from reliance on any information
          obtained through the Platform. Our total aggregate liability, for any claim, shall not
          exceed the fees you paid to us in the 90 days preceding the claim.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="12. Indemnity">
        <PolicyParagraph>
          You agree to indemnify and hold us harmless from any claim arising out of your use of the
          Platform, your breach of these Terms, your uploaded data, or any transaction you enter into
          with another user.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="13. Suspension and termination">
        <PolicyParagraph>
          We may suspend or terminate any account that violates these Terms, uploads incorrect data,
          or misuses the Platform, with or without notice.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="14. Governing law and jurisdiction">
        <PolicyParagraph>
          These Terms are governed by the laws of India. The courts at{' '}
          <PolicyStrong>Delhi</PolicyStrong> shall have exclusive jurisdiction over any dispute.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="15. Changes to these Terms">
        <PolicyParagraph>
          We may update these Terms from time to time. Continued use after changes constitutes
          acceptance. Material changes will be notified on the Platform.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="16. Contact">
        <PolicyContact
          lines={[
            'Jaspal Singh & Associates',
            'Registered office, Delhi',
            'Email: support@dataofbusiness.in',
          ]}
        />
        <PolicyParagraph>
          For grievances, see our{' '}
          <PolicyLink onPress={() => navigation.navigate('Grievance')}>
            Grievance Redressal page
          </PolicyLink>
          .
        </PolicyParagraph>
      </PolicySection>
    </PolicyPage>
  );
}

// ------------------------------------------------------------------ styles

const styles = StyleSheet.create({
  feeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  feeRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  feeLabel: {
    flex: 1,
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 21,
  },
  feeValue: {
    flex: 1.5,
    ...typography.body,
    color: '#2C3550',
    lineHeight: 21,
  },
});
