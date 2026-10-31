import React, { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchPublicBusinesses } from '../../api/endpoints';
import type { PublicStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<PublicStackParamList, 'Landing'>;

const INTRO_VIDEO = require('../../../assets/intro_video.mp4');

const PALETTE = {
  navy: '#1E2761',
  navy2: '#2A3580',
  navyDeep: '#141B47',
  gold: '#E8B84B',
  teal: '#0D9488',
  blue: '#2563EB',
  green: '#16A34A',
  red: '#DC2626',
  bg: '#F6F7FB',
  card: '#FFFFFF',
  ink: '#1A2238',
  mut: '#5A6478',
  faint: '#98A1B3',
  line: '#E3E7F0',
};

const cardShadow = Platform.select({
  web: { boxShadow: '0 1px 3px rgba(20,27,71,0.07), 0 8px 24px rgba(20,27,71,0.06)' },
  default: { elevation: 1 },
}) as ViewStyle;

const TRUST = [
  '✓ ICAI-verified CA certification',
  '✓ Research & due-diligence use only',
  '✓ No securities · No transactions',
  '✓ Every access audit-logged',
];

const IS = [
  'A corporate intelligence & research database',
  'A source of CA-certified company financials',
  'A business-information service for diligence',
  'A directory of verified company profiles & contacts',
  'A subscription information product',
];

const IS_NOT = [
  'NOT a stock exchange or securities marketplace',
  'NOT a broker, investment adviser or research analyst',
  'NOT a fundraising or capital-raising platform',
  'We do NOT offer, price, or facilitate any securities',
  'We do NOT solicit investment or arrange any transaction',
];

const PURPOSES = [
  {
    icon: '🔍',
    bg: '#E8F7F1',
    title: 'Supplier & vendor diligence',
    body: 'Verify the financial health and track record of a supplier or vendor before contracting.',
  },
  {
    icon: '🤝',
    bg: '#E7EEFB',
    title: 'Partnership evaluation',
    body: "Assess a potential business partner's financials and stability before committing.",
  },
  {
    icon: '📊',
    bg: '#FBF3E2',
    title: 'Competitor & market research',
    body: 'Benchmark performance and study industry peers using verified data.',
  },
  {
    icon: '🎯',
    bg: '#EDE9FB',
    title: 'Customer & lead qualification',
    body: 'Qualify prospective B2B customers by verified turnover and creditworthiness.',
  },
  {
    icon: '🏢',
    bg: '#E8F4F7',
    title: 'Acquisition & M&A research',
    body: 'Identify and study acquisition or merger targets through reliable financials.',
  },
  {
    icon: '📈',
    bg: '#F0FBF7',
    title: 'General corporate intelligence',
    body: 'Build a verified view of a company before any business engagement.',
  },
];

const COMPANY_STEPS = [
  'Register with company PAN + mobile OTP',
  'Publish CA-certified financials & 36-month turnover',
  'Add company profile, directors & contact details',
  'Optionally add a corporate profile video',
  'Sign the no-securities declaration',
  'Go live after verification — for research visibility',
];

const MEMBER_STEPS = [
  'Register with PAN + mobile OTP',
  'Accept the research-use declaration',
  'Subscribe for research access',
  'Browse & filter the verified company database',
  'View full financials, profile & contact details',
  'Download up to 5 company research profiles',
];

const LISTING_FEATURES = [
  'CA-certified financials hosted',
  '36-month turnover showcase',
  'Company profile & corporate video',
  'Visible to verified research members',
];

const MEMBER_FEATURES = [
  'Full company names & identity',
  'CA-certified financial statements',
  'Company profile videos & contacts',
];

export default function LandingScreen({ navigation }: Props) {
  const [listings, setListings] = useState(0);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 700;
  const heroTitleSize = width >= 1000 ? 44 : width >= 700 ? 36 : 29;

  const scrollRef = useRef<ScrollViewInstance>(null);
  const introSectionY = useRef(0);
  const introPlayer = useVideoPlayer(INTRO_VIDEO, (player) => {
    player.loop = false;
  });

  // Mirrors the site's repeat(auto-fit, minmax(220px, 1fr)) grid: the last row
  // keeps the same card width as the full rows instead of stretching.
  const contentWidth = Math.min(width, 1080) - 40;
  const purposeColumns = contentWidth >= 920 ? 4 : contentWidth >= 660 ? 3 : contentWidth >= 440 ? 2 : 1;
  const purposeWidth = (contentWidth - 18 * (purposeColumns - 1)) / purposeColumns;

  useEffect(() => {
    fetchPublicBusinesses({ page: 0, size: 1 })
      .then((result) => setListings(result.total))
      .catch(() => {
        // The landing page still renders; the counter stays at its initial value.
      });
  }, []);

  const joinAsResearcher = () => navigation.navigate('Register', { role: 'researcher' });
  const joinAsBusiness = () => navigation.navigate('Register', { role: 'business' });
  const openOnlineCa = () => {
    void Linking.openURL('https://onlinecacertificate.in');
  };
  const playIntro = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, introSectionY.current - 16), animated: true });
    introPlayer.play();
  };

  return (
    <ScrollView ref={scrollRef} style={styles.page} contentContainerStyle={styles.pageContent}>
      {/* NAV */}
      <View style={[styles.nav, { paddingTop: insets.top }]}>
        <View style={[styles.container, styles.navInner]}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="DataOfBusiness home"
            onPress={() => navigation.navigate('Landing')}
            style={styles.logoRow}
          >
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>
                D<Text style={styles.logoMarkO}>o</Text>B
              </Text>
            </View>
            <View>
              <Text style={styles.logoText}>DataOfBusiness</Text>
              <Text style={styles.logoTag}>CORPORATE INTELLIGENCE PLATFORM</Text>
            </View>
          </Pressable>
          <View style={styles.navActions}>
            {width >= 640 ? (
              <>
                <LandingButton
                  label="Company Database"
                  variant="ghost"
                  onPress={() => navigation.navigate('CompanyDatabase')}
                />
                <LandingButton label="List Your Company" variant="ghost" onPress={joinAsBusiness} />
              </>
            ) : null}
            <LandingButton label="Sign in" variant="ghost" onPress={() => navigation.navigate('Login')} />
            <LandingButton label="Get Research Access" variant="navy" onPress={joinAsResearcher} />
          </View>
        </View>
      </View>

      {/* HERO */}
      <LinearGradient
        colors={[PALETTE.navyDeep, PALETTE.navy, '#2E3D8F']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.hero, { paddingTop: compact ? 48 : 64, paddingBottom: compact ? 44 : 56 }]}
      >
        <LinearGradient
          colors={['rgba(232,184,75,0.20)', 'rgba(232,184,75,0.05)', 'rgba(232,184,75,0)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.15, y: 0.15 }}
          end={{ x: 0.85, y: 0.85 }}
          style={styles.heroGlow}
        />
        <View style={styles.container}>
          <View style={styles.heroBadge}>
            <View style={styles.heroDot} />
            <Text style={styles.heroBadgeText}>
              {"India's private company intelligence platform"}
            </Text>
          </View>
          <Text
            style={[styles.heroTitle, { fontSize: heroTitleSize, lineHeight: Math.round(heroTitleSize * 1.15) }]}
          >
            Verified company financials,{'\n'}for{' '}
            <Text style={styles.heroAccent}>research & due diligence.</Text>
          </Text>
          <Text style={styles.heroSub}>
            DataOfBusiness is a corporate research database. Indian companies publish CA-certified
            financial information and business profiles. Research members access verified data for
            supplier diligence, partnership evaluation, competitor research and corporate
            intelligence.
          </Text>
          <View style={styles.heroActions}>
            <LandingButton
              label="Explore Company Database →"
              variant="gold"
              size="lg"
              onPress={() => navigation.navigate('CompanyDatabase')}
            />
            <LandingButton label="List Your Company" variant="glass" size="lg" onPress={joinAsBusiness} />
            <LandingButton label="▶ Watch intro" variant="glass" size="lg" onPress={playIntro} />
          </View>
          <View style={styles.heroStats}>
            <HeroStat value={String(listings)} label="Companies listed" />
            <HeroStat value="36" label="Months of financial data" />
            <HeroStat value="100%" label="CA-certified" />
            <HeroStat value="DPDP" label="Compliant & confidential" />
          </View>
        </View>
      </LinearGradient>

      {/* TRUST STRIP */}
      <View style={styles.trust}>
        <View style={[styles.container, styles.trustInner]}>
          {TRUST.map((item) => (
            <Text key={item} style={styles.trustItem}>{item}</Text>
          ))}
        </View>
      </View>

      {/* INTRO VIDEO */}
      <View
        style={[styles.introSection, { paddingVertical: compact ? 36 : 48 }]}
        onLayout={(event) => {
          introSectionY.current = event.nativeEvent.layout.y;
        }}
      >
        <View style={styles.container}>
          <Text style={styles.secTitle}>See how DataOfBusiness works</Text>
          <Text style={styles.secSub}>
            A short introduction to the platform — how verified company information is published,
            and how research members access it.
          </Text>
          <View style={styles.introFrame}>
            <VideoView
              player={introPlayer}
              style={styles.introVideo}
              nativeControls
              contentFit="contain"
              playsInline
              fullscreenOptions={{ enable: true }}
            />
            <View style={styles.introTag} pointerEvents="none">
              <View style={styles.introTagDot} />
              <Text style={styles.introTagText}>PLATFORM INTRO</Text>
            </View>
          </View>
        </View>
      </View>

      {/* WHAT THIS PLATFORM IS / IS NOT */}
      <View style={[styles.section, styles.whiteSection, styles.borderBottom, { paddingVertical: compact ? 42 : 56 }]}>
        <View style={styles.container}>
          <Text style={styles.secTitle}>A research database — nothing more</Text>
          <Text style={styles.secSub}>
            DataOfBusiness exists to provide verified business information. We are deliberately
            clear about what we are, and what we are not.
          </Text>
          <View style={styles.wwaRow}>
            <View style={[styles.wwaCard, styles.wwaIs]}>
              <Text style={[styles.wwaTitle, { color: '#0B6B4F' }]}>
                ✓ What DataOfBusiness IS
              </Text>
              {IS.map((item) => (
                <View key={item} style={styles.wwaItemRow}>
                  <Text style={[styles.wwaMark, { color: PALETTE.green }]}>✓</Text>
                  <Text style={styles.wwaItem}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.wwaCard, styles.wwaIsNot]}>
              <Text style={[styles.wwaTitle, { color: '#B42318' }]}>
                ✕ What DataOfBusiness is NOT
              </Text>
              {IS_NOT.map((item) => (
                <View key={item} style={styles.wwaItemRow}>
                  <Text style={[styles.wwaMark, { color: PALETTE.red }]}>✕</Text>
                  <Text style={styles.wwaItem}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* PURPOSES */}
      <View style={[styles.section, { paddingVertical: compact ? 42 : 56 }]}>
        <View style={styles.container}>
          <Text style={styles.secTitle}>What members use it for</Text>
          <Text style={styles.secSub}>
            Verified financial data supports many corporate research and due-diligence needs.
          </Text>
          <View style={styles.purposeGrid}>
            {PURPOSES.map((purpose) => (
              <View key={purpose.title} style={[styles.purpose, { width: purposeWidth }]}>
                <View style={[styles.purposeIcon, { backgroundColor: purpose.bg }]}>
                  <Text style={styles.purposeEmoji}>{purpose.icon}</Text>
                </View>
                <Text style={styles.purposeTitle}>{purpose.title}</Text>
                <Text style={styles.purposeBody}>{purpose.body}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* HOW IT WORKS */}
      <View
        style={[
          styles.section,
          styles.whiteSection,
          styles.borderTop,
          styles.borderBottom,
          { paddingVertical: compact ? 42 : 56 },
        ]}
      >
        <View style={styles.container}>
          <Text style={styles.secTitle}>How it works</Text>
          <Text style={styles.secSub}>
            Companies publish verified data. Research members access it on subscription.
          </Text>
          <View style={styles.wwaRow}>
            <View style={styles.panel}>
              <Text style={[styles.panelTitle, { color: PALETTE.teal }]}>🏢 For Companies</Text>
              {COMPANY_STEPS.map((step, index) => (
                <Text key={step} style={styles.panelStep}>
                  {index + 1}. {step}
                </Text>
              ))}
            </View>
            <View style={styles.panel}>
              <Text style={[styles.panelTitle, { color: PALETTE.blue }]}>🔎 For Research Members</Text>
              {MEMBER_STEPS.map((step, index) => (
                <Text key={step} style={styles.panelStep}>
                  {index + 1}. {step}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* ONLINECACERTIFICATE CROSS-SELL */}
      <View style={[styles.section, { paddingVertical: 36 }]}>
        <View style={styles.container}>
          <LinearGradient
            colors={[PALETTE.navy, PALETTE.navy2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.crossSell}
          >
            <View style={styles.crossSellIcon}>
              <Text style={styles.crossSellCheck}>✓</Text>
            </View>
            <View style={styles.crossSellCopy}>
              <Text style={styles.crossSellTitle}>
                {"Don't have a CA to certify your financials?"}
              </Text>
              <Text style={styles.crossSellBody}>
                Get your turnover and financial statements certified online through our partner
                platform — UDIN-verified by practising Chartered Accountants, in 24–48 hours.
              </Text>
            </View>
            <LandingButton label="OnlineCACertificate.in →" variant="gold" onPress={openOnlineCa} />
          </LinearGradient>
        </View>
      </View>

      {/* PRICING */}
      <View
        style={[
          styles.section,
          styles.whiteSection,
          styles.borderTop,
          { paddingVertical: compact ? 42 : 56 },
        ]}
      >
        <View style={styles.container}>
          <Text style={styles.secTitle}>Subscription pricing</Text>
          <Text style={styles.secSub}>
            A flat information-access subscription. No commissions, no success fees — we are paid
            for data access only, never for any transaction.
          </Text>
          <View style={styles.priceGrid}>
            <View style={styles.priceCard}>
              <Text style={styles.priceName}>Company Listing</Text>
              <View style={styles.priceAmountRow}>
                <Text style={styles.priceAmount}>₹500</Text>
                <Text style={styles.priceUnit}>/ year of data</Text>
              </View>
              <Text style={styles.priceBlurb}>
                Publish your verified financials for research visibility. + GST.
              </Text>
              {LISTING_FEATURES.map((feature) => (
                <Feature key={feature} label={feature} />
              ))}
              <LandingButton
                label="List Your Company"
                variant="ghost"
                onPress={joinAsBusiness}
                style={styles.priceButton}
              />
            </View>

            <View style={[styles.priceCard, styles.priceCardFeatured]}>
              <View style={styles.popBadge}>
                <Text style={styles.popBadgeText}>FOR RESEARCH MEMBERS</Text>
              </View>
              <Text style={[styles.priceName, { marginTop: 8 }]}>Research Access</Text>
              <View style={styles.priceAmountRow}>
                <Text style={styles.priceAmount}>₹2,500</Text>
                <Text style={styles.priceUnit}>/ 3 months</Text>
              </View>
              <Text style={styles.priceBlurb}>
                Full database access for 90 days. + 18% GST = ₹2,950.
              </Text>
              {MEMBER_FEATURES.map((feature) => (
                <Feature key={feature} label={feature} />
              ))}
              <Feature label="Download 5 research profiles" strong />
              <LandingButton
                label="Get Research Access"
                variant="navy"
                onPress={joinAsResearcher}
                style={styles.priceButton}
              />
            </View>
          </View>
        </View>
      </View>

      {/* FOOTER */}
      <View style={styles.footer}>
        <View style={styles.container}>
          <View style={styles.footGrid}>
            <View style={styles.footAbout}>
              <View style={[styles.logoRow, { marginBottom: 14 }]}>
                <View style={styles.logoMark}>
                  <Text style={styles.logoMarkText}>
                    D<Text style={styles.logoMarkO}>o</Text>B
                  </Text>
                </View>
                <Text style={[styles.logoText, { color: '#FFFFFF' }]}>DataOfBusiness</Text>
              </View>
              <Text style={styles.footBlurb}>
                {"India's private company intelligence platform. CA-certified financial information "}
                published for research, diligence and corporate-visibility purposes.
              </Text>
            </View>

            <View style={styles.footCol}>
              <Text style={styles.footHeading}>Platform</Text>
              <FootLink label="Company Database" onPress={() => navigation.navigate('CompanyDatabase')} />
              <FootLink label="List Your Company" onPress={joinAsBusiness} />
              <FootLink label="Research Access" onPress={joinAsResearcher} />
              <FootLink label="Get CA Certificate ↗" onPress={openOnlineCa} />
            </View>

            <View style={styles.footCol}>
              <Text style={styles.footHeading}>Legal</Text>
              <Text style={styles.footLink}>Terms of Service</Text>
              <Text style={styles.footLink}>Privacy Policy (DPDP 2023)</Text>
              <Text style={styles.footLink}>Refund Policy</Text>
              <Text style={styles.footLink}>Grievance & Contact</Text>
            </View>
          </View>

          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>
              <Text style={styles.disclaimerLead}>IMPORTANT DISCLAIMER: </Text>
              DataOfBusiness is a corporate information and research platform only. We are NOT a
              stock exchange, broker, depository, investment adviser, research analyst, portfolio
              manager, peer-to-peer lending platform, or any intermediary regulated under the SEBI
              Act 1992, the Securities Contracts (Regulation) Act 1956, or the RBI&apos;s NBFC-P2P
              Directions. We do NOT offer, price, recommend, or facilitate any securities; we do
              NOT raise capital, solicit investment, accept deposits, or arrange loans; and we do
              NOT broker, match, negotiate, or participate in any transaction. All financial
              information is supplied by listed companies and certified by their respective
              Chartered Accountants. Members must conduct their own independent due diligence. Any
              dealing a member may pursue with a company happens entirely off this platform,
              privately, between identified parties, at their own risk. Access is restricted to
              Indian residents.
            </Text>
          </View>

          <View style={styles.footLegal}>
            <Text style={styles.footLegalText}>
              © 2026 DataOfBusiness · dataofbusiness.in · A corporate research & information
              service · All subscription fees include applicable GST · Made in India
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ------------------------------------------------------------------ pieces

type ButtonVariant = 'gold' | 'navy' | 'ghost' | 'glass';

function LandingButton({
  label,
  variant,
  size = 'md',
  onPress,
  style,
}: {
  label: string;
  variant: ButtonVariant;
  size?: 'md' | 'lg';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        size === 'lg' && styles.btnLg,
        variant === 'gold' && styles.btnGold,
        variant === 'navy' && styles.btnNavy,
        variant === 'ghost' && styles.btnGhost,
        variant === 'glass' && styles.btnGlass,
        pressed && styles.btnPressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          size === 'lg' && styles.btnTextLg,
          variant === 'gold' && styles.btnTextGold,
          (variant === 'navy' || variant === 'glass') && styles.btnTextLight,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function Feature({ label, strong }: { label: string; strong?: boolean }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureCheck}>✓</Text>
      <Text style={[styles.featureText, strong && styles.featureTextStrong]}>{label}</Text>
    </View>
  );
}

function FootLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress}>
      <Text style={styles.footLink}>{label}</Text>
    </Pressable>
  );
}

// ------------------------------------------------------------------ styles

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: PALETTE.bg },
  pageContent: { backgroundColor: PALETTE.bg },
  container: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },

  // nav
  nav: {
    backgroundColor: PALETTE.card,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.line,
  },
  navInner: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    rowGap: 8,
    paddingVertical: 10,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    minWidth: 42,
    height: 34,
    paddingHorizontal: 7,
    backgroundColor: PALETTE.navy,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: {
    color: PALETTE.gold,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  logoMarkO: { color: '#FFFFFF' },
  logoText: { fontWeight: '700', fontSize: 16, color: PALETTE.navy },
  logoTag: {
    fontSize: 9.5,
    fontWeight: '500',
    color: PALETTE.faint,
    letterSpacing: 0.4,
    lineHeight: 12,
    marginTop: 1,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    flexGrow: 1,
    gap: 6,
  },

  // buttons
  btn: {
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  btnLg: { paddingHorizontal: 26, paddingVertical: 13 },
  btnGold: { backgroundColor: PALETTE.gold },
  btnNavy: { backgroundColor: PALETTE.navy },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: PALETTE.line,
  },
  btnGlass: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  btnPressed: { opacity: 0.82 },
  btnText: { fontSize: 13.5, fontWeight: '600' },
  btnTextLg: { fontSize: 15 },
  btnTextGold: { color: PALETTE.navy },
  btnTextLight: { color: '#FFFFFF' },

  // hero
  hero: { overflow: 'hidden', position: 'relative', paddingHorizontal: 0 },
  heroGlow: {
    position: 'absolute',
    right: -120,
    top: -120,
    width: 420,
    height: 420,
    borderRadius: 210,
    overflow: 'hidden',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    marginBottom: 22,
  },
  heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: PALETTE.gold },
  heroBadgeText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '600' },
  heroTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.5,
    maxWidth: 760,
  },
  heroAccent: { color: PALETTE.gold },
  heroSub: {
    fontSize: 17,
    color: '#C8D1F0',
    maxWidth: 620,
    marginTop: 18,
    marginBottom: 30,
    lineHeight: 29,
  },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 36,
    marginTop: 42,
  },
  heroStat: { minWidth: 110 },
  heroStatValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  heroStatLabel: { color: '#9FACDD', fontSize: 12.5, marginTop: 2 },

  // trust strip
  trust: {
    backgroundColor: PALETTE.card,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.line,
    paddingVertical: 18,
  },
  trustInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 36,
    rowGap: 8,
  },
  trustItem: { fontSize: 13, color: PALETTE.mut, fontWeight: '600' },

  // intro video
  introSection: {
    backgroundColor: PALETTE.bg,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.line,
  },
  introFrame: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: PALETTE.navyDeep,
    borderWidth: 1,
    borderColor: 'rgba(20,27,71,0.18)',
    ...cardShadow,
  },
  introVideo: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0B1030' },
  introTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(11,16,48,0.72)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 99,
  },
  introTagDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: PALETTE.gold },
  introTagText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // sections
  section: { paddingVertical: 56 },
  whiteSection: { backgroundColor: PALETTE.card },
  borderTop: { borderTopWidth: 1, borderTopColor: PALETTE.line },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: PALETTE.line },
  secTitle: {
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    color: PALETTE.ink,
  },
  secSub: {
    textAlign: 'center',
    color: PALETTE.mut,
    maxWidth: 600,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 42,
    fontSize: 15,
    lineHeight: 24,
  },

  // what we are / not
  wwaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  wwaCard: {
    flexGrow: 1,
    flexBasis: 380,
    borderRadius: 12,
    padding: 24,
  },
  wwaIs: { backgroundColor: '#F0FBF7', borderWidth: 1, borderColor: '#BCE7D8' },
  wwaIsNot: { backgroundColor: '#FFF7F7', borderWidth: 1, borderColor: '#F4CFCF' },
  wwaTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  wwaItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 9,
  },
  wwaMark: { fontWeight: '800', fontSize: 13.5, lineHeight: 21.5 },
  wwaItem: { flex: 1, fontSize: 13.5, lineHeight: 21.5, color: '#33415C' },

  // purpose cards
  purposeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  purpose: {
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.line,
    borderRadius: 12,
    padding: 22,
    ...cardShadow,
  },
  purposeIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  purposeEmoji: { fontSize: 20 },
  purposeTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    marginBottom: 6,
    color: PALETTE.ink,
  },
  purposeBody: { fontSize: 13, color: PALETTE.mut, lineHeight: 20.8 },

  // how it works panels
  panel: {
    flexGrow: 1,
    flexBasis: 380,
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.line,
    borderRadius: 12,
    padding: 24,
    ...cardShadow,
  },
  panelTitle: { fontSize: 15.5, fontWeight: '700', marginBottom: 16 },
  panelStep: { fontSize: 13.5, color: PALETTE.mut, lineHeight: 27 },

  // cross-sell
  crossSell: {
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 26,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 18,
  },
  crossSellIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(232,184,75,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(232,184,75,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossSellCheck: { color: PALETTE.gold, fontWeight: '800', fontSize: 21 },
  crossSellCopy: { flex: 1, minWidth: 240 },
  crossSellTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  crossSellBody: { color: '#C8D1F0', fontSize: 13, lineHeight: 20.8, marginTop: 4 },

  // pricing
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  priceCard: {
    flexGrow: 1,
    flexBasis: 300,
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.line,
    borderRadius: 12,
    padding: 30,
    ...cardShadow,
  },
  priceCardFeatured: { borderWidth: 2, borderColor: PALETTE.navy },
  popBadge: {
    position: 'absolute',
    top: -12,
    left: 26,
    backgroundColor: PALETTE.navy,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 99,
  },
  popBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  priceName: { fontSize: 15, fontWeight: '700', color: PALETTE.ink },
  priceAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 10,
    marginBottom: 2,
  },
  priceAmount: { fontSize: 32, fontWeight: '800', color: PALETTE.ink },
  priceUnit: { fontSize: 14, fontWeight: '500', color: PALETTE.mut },
  priceBlurb: {
    fontSize: 12.5,
    color: PALETTE.mut,
    marginBottom: 18,
    lineHeight: 19,
  },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 10 },
  featureCheck: { color: PALETTE.green, fontWeight: '800', fontSize: 13.5, marginTop: 1 },
  featureText: { flex: 1, fontSize: 13.5, color: PALETTE.mut, lineHeight: 20 },
  featureTextStrong: { fontWeight: '700', color: PALETTE.ink },
  priceButton: { marginTop: 14 },

  // footer
  footer: {
    backgroundColor: PALETTE.navyDeep,
    paddingTop: 44,
    paddingBottom: 30,
    marginTop: 40,
  },
  footGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 32,
    marginBottom: 28,
  },
  footAbout: { flexGrow: 2, flexBasis: 320 },
  footCol: { flexGrow: 1, flexBasis: 160 },
  footBlurb: {
    fontSize: 12.5,
    lineHeight: 21.25,
    color: '#9FACDD',
    maxWidth: 340,
  },
  footHeading: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700', marginBottom: 12 },
  footLink: {
    color: '#9FACDD',
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 20,
  },
  disclaimerBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  disclaimerText: {
    fontSize: 11.5,
    lineHeight: 19.55,
    color: '#7783B8',
  },
  disclaimerLead: { color: '#C8D1F0', fontWeight: '700' },
  footLegal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 20,
  },
  footLegalText: { fontSize: 11.5, lineHeight: 19.55, color: '#7783B8' },
});
