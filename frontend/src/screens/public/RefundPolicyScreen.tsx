import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  PolicyBullet,
  PolicyCallout,
  PolicyContact,
  PolicyIntro,
  PolicyPage,
  PolicyParagraph,
  PolicySection,
  PolicyStrong,
} from '../../components/policy';
import type { PublicStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<PublicStackParamList, 'RefundPolicy'>;

export default function RefundPolicyScreen({ navigation }: Props) {
  return (
    <PolicyPage
      title="Refund & cancellation policy"
      updated="31 October 2026"
      onBack={() => navigation.goBack()}
    >
      <PolicyIntro>
        This policy explains when and how refunds and cancellations apply to fees paid on{' '}
        <PolicyStrong>dataofbusiness.in</PolicyStrong>. It applies to both Business listing fees and
        Investor membership fees. All payments are processed through our payment gateway, Razorpay.
      </PolicyIntro>

      <PolicySection title="1. Nature of the service">
        <PolicyParagraph>
          DataOfBusiness.in provides access to digital information services — anonymized and full
          business financial data, and listing visibility. Because access to digital content is
          granted immediately upon payment, refunds are limited as described below. Please review
          the service carefully before paying.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="2. Investor membership refunds">
        <PolicyBullet lead="7-day cooling-off window:">
          If you have <PolicyStrong>not</PolicyStrong> downloaded any business profile and have{' '}
          <PolicyStrong>not</PolicyStrong> revealed the identity of any listing, you may request a
          full refund within 7 days of payment.
        </PolicyBullet>
        <PolicyBullet lead="After access is used:">
          Once you have downloaded any profile, revealed any identity, or your membership has been
          active for more than 7 days, the membership fee is non-refundable, as the digital service
          has been substantially consumed.
        </PolicyBullet>
        <PolicyBullet lead="Low-inventory protection:">
          If, at the time of your payment, the Platform had fewer than 10 live listings in total, you
          may request a full refund within 7 days even if you have browsed (but not downloaded)
          listings.
        </PolicyBullet>
      </PolicySection>

      <PolicySection title="3. Business listing fee refunds">
        <PolicyBullet lead="Before going live:">
          If your listing is rejected during our verification review, the listing fee is fully
          refunded.
        </PolicyBullet>
        <PolicyBullet lead="After going live:">
          Once your listing is approved and published, the listing fee is non-refundable, as the
          service (visibility to Investors) has commenced.
        </PolicyBullet>
        <PolicyBullet lead="Voluntary removal:">
          You may remove your listing at any time, but no pro-rata refund is provided for the unused
          listing period.
        </PolicyBullet>
      </PolicySection>

      <PolicySection title="4. No refund for transaction outcomes">
        <PolicyCallout>
          The Platform charges only for information access and listing visibility. We do{' '}
          <PolicyStrong>not</PolicyStrong> charge any success fee, commission, or transaction fee,
          and we are not a party to any investment or loan.{' '}
          <PolicyStrong>
            No refund is available based on the outcome of any investment, loan, or negotiation
          </PolicyStrong>{' '}
          you enter into with another user, as such transactions occur entirely outside the Platform
          and at your own risk.
        </PolicyCallout>
      </PolicySection>

      <PolicySection title="5. How to request a refund">
        <PolicyParagraph>
          To request a refund, email <PolicyStrong>support@dataofbusiness.in</PolicyStrong> from your
          registered email address, with your registered mobile number, payment ID, and reason. We
          will review eligibility against this policy and respond within{' '}
          <PolicyStrong>3 business days</PolicyStrong>.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="6. Refund processing">
        <PolicyParagraph>
          Approved refunds are processed to the original payment method through Razorpay within{' '}
          <PolicyStrong>7–10 business days</PolicyStrong>. GST already remitted on a refunded
          transaction will be adjusted as permitted by law. Any payment-gateway charges, where
          non-recoverable, may be deducted from the refund amount.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="7. Cancellation of auto-renewal">
        <PolicyParagraph>
          Memberships do <PolicyStrong>not</PolicyStrong> auto-renew by default. If auto-renewal is
          offered and enabled in future, you may cancel it anytime from your account before the
          renewal date to avoid the next charge.
        </PolicyParagraph>
      </PolicySection>

      <PolicySection title="8. Contact">
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
