import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  fetchBusiness,
  fetchMySubscription,
  unlockBusiness,
} from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { BusinessLiability, BusinessRecord, MySubscription } from '../../api/types';
import { Sparkline } from '../../components/Sparkline';
import {
  Banner,
  Button,
  Loading,
  Muted,
  Screen,
} from '../../components/ui';
import type { ResearcherStackParamList } from '../../navigation/types';
import { formatInrCompact } from '../../lib/format';
import { colors, radius, shadows, spacing } from '../../theme';

const AVATAR_COLORS = [
  '#1E2761',
  '#0D9488',
  '#7C3AED',
  '#B45309',
  '#BE185D',
  '#1D4FA8',
  '#0F766E',
  '#9333EA',
];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

interface Financials {
  turnover: number[];
  ttm?: number;
  growth: number | null;
  bands: { label: string; annual: number; monthlyAvg: number; peak: number }[];
}

function financials(record: BusinessRecord): Financials {
  const turnover = Array.isArray(record.monthly_turnover) ? record.monthly_turnover : [];
  const ttm = turnover.length >= 12
    ? sum(turnover.slice(-12))
    : record.annual_revenue ?? (turnover.length ? sum(turnover) : undefined);
  const firstYear = turnover.length >= 24 ? sum(turnover.slice(0, 12)) : 0;
  const growth = firstYear > 0 ? Math.round(((sum(turnover.slice(-12)) - firstYear) / firstYear) * 100) : null;

  const bands: Financials['bands'] = [];
  const year = new Date().getFullYear();
  const count = Math.floor(turnover.length / 12);
  for (let band = 0; band < count; band++) {
    const slice = turnover.slice(band * 12, band * 12 + 12);
    const startYear = year - count + band;
    bands.push({
      label: `FY ${startYear}–${String(startYear + 1).slice(2)}`,
      annual: sum(slice),
      monthlyAvg: sum(slice) / slice.length,
      peak: Math.max(...slice),
    });
  }
  return { turnover, ttm, growth, bands };
}

function Panel({ title, children, style }: {
  title: React.ReactNode;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.panel, style]}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </View>
  );
}

function KeyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

export default function CompanyProfileScreen() {
  const route = useRoute<RouteProp<ResearcherStackParamList, 'BusinessDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<ResearcherStackParamList>>();
  const { id, title } = route.params;

  const [record, setRecord] = useState<BusinessRecord | null>(null);
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRecord(await fetchBusiness(id));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    fetchMySubscription().then(setSubscription).catch(() => undefined);
  }, [load]);

  const unlock = async () => {
    setUnlocking(true);
    setError(null);
    try {
      const response = await unlockBusiness(id);
      setMessage(
        response.alreadyUnlocked
          ? 'This company was already unlocked.'
          : `Company unlocked. You have ${response.creditsRemaining} credits remaining.`,
      );
      setConfirming(false);
      await Promise.all([
        load(),
        fetchMySubscription().then(setSubscription).catch(() => undefined),
      ]);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <Screen topInset={false}>
        <Loading label="Loading company profile…" />
      </Screen>
    );
  }

  if (!record) {
    return (
      <Screen topInset={false}>
        {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
        <Muted>Company not found.</Muted>
      </Screen>
    );
  }

  const unlocked = record.unlocked === true;
  const { turnover, ttm, growth, bands } = financials(record);
  const code = String(record.public_code ?? title ?? record.id.slice(0, 9).toUpperCase());
  const name = unlocked
    ? String(record.legal_name ?? record.trade_name ?? 'Company')
    : String(record.industry ?? 'Company');
  const color = colorFor(record.id);
  const initial = String(record.industry ?? name).trim().charAt(0).toUpperCase() || 'C';
  const meta = [
    code,
    [record.city, record.state].filter(Boolean).join(', '),
    record.employee_count ? `${record.employee_count} employees` : null,
  ].filter(Boolean).join(' · ');
  const credits = subscription?.creditsRemaining ?? 0;
  const active = subscription?.active === true;
  const videoUrl = typeof record.profile_video_url === 'string' ? record.profile_video_url.trim() : '';
  const liabilities = Array.isArray(record.liabilities)
    ? (record.liabilities as BusinessLiability[])
    : null;
  const liabilityTotal = (liabilities ?? []).reduce(
    (total, liability) => total + (Number(liability.amount) || 0),
    0,
  );
  const caName = typeof record.ca_name === 'string' ? record.ca_name.trim() : '';
  const caMembership = typeof record.ca_membership_no === 'string' ? record.ca_membership_no.trim() : '';
  const caUdin = typeof record.ca_udin === 'string' ? record.ca_udin.trim() : '';
  const hasCaStatements = Boolean(caName || caMembership || caUdin);

  const openVideo = async () => {
    if (!videoUrl) return;
    try {
      await Linking.openURL(videoUrl);
    } catch {
      setError('Could not open the profile video link. Please try again.');
    }
  };

  return (
    <Screen topInset={false} contentWidth={1080}>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}

      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.headText}>
          <Text style={styles.headName}>{name}</Text>
          <Text style={styles.headMeta}>{meta}</Text>
          <View style={styles.tagRow}>
            {record.category ? (
              <View style={[styles.tag, styles.tagSector]}>
                <Text style={[styles.tagText, styles.tagSectorText]}>{record.category}</Text>
              </View>
            ) : null}
            {record.industry ? (
              <View style={[styles.tag, styles.tagSector]}>
                <Text style={[styles.tagText, styles.tagSectorText]}>{record.industry}</Text>
              </View>
            ) : null}
            <View style={[styles.tag, unlocked ? styles.tagUnlocked : styles.tagCode]}>
              <Text style={[styles.tagText, unlocked ? styles.tagUnlockedText : styles.tagCodeText]}>
                {unlocked ? '✓ Identity unlocked' : '🔒 Code only'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.researchBanner}>
        <Text style={styles.researchBannerText}>
          📋 This company profile is provided for{' '}
          <Text style={styles.researchBannerStrong}>
            research, due-diligence and corporate-intelligence purposes only
          </Text>
          . The information is published by the company. DataOfBusiness makes no offer of
          securities, no recommendation, and facilitates no transaction. Any engagement you pursue
          with this company is private and entirely at your own discretion and risk.
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.columnLeft}>
          <Panel title="📈 36-Month Turnover Trend (₹ / month, excl. GST)">
            {turnover.length >= 2 ? (
              <>
                <Sparkline data={turnover} color={color} height={120} width={600} />
                <View style={styles.trendCaption}>
                  <Text style={styles.captionText}>36 months ago</Text>
                  <Text style={styles.captionText}>Latest month</Text>
                </View>
                <View style={styles.table}>
                  <View style={[styles.tableRow, styles.tableHead]}>
                    <Text style={[styles.th, styles.colPeriod]}>Period</Text>
                    <Text style={[styles.th, styles.colNum]}>Annual</Text>
                    <Text style={[styles.th, styles.colNum]}>Monthly Avg</Text>
                    <Text style={[styles.th, styles.colNum]}>Peak</Text>
                  </View>
                  {bands.map((band) => (
                    <View key={band.label} style={[styles.tableRow, styles.tableBody]}>
                      <Text style={[styles.td, styles.colPeriod, styles.tdBold]}>{band.label}</Text>
                      <Text style={[styles.td, styles.colNum]}>{formatInrCompact(band.annual)}</Text>
                      <Text style={[styles.td, styles.colNum]}>{formatInrCompact(band.monthlyAvg)}</Text>
                      <Text style={[styles.td, styles.colNum]}>{formatInrCompact(band.peak)}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Muted>No turnover data published for this company.</Muted>
            )}
          </Panel>

          <Panel title="📋 Company Profile">
            <Text style={styles.description}>
              {record.description
                ? String(record.description)
                : 'No company description has been published yet.'}
            </Text>
            <View style={styles.tiles}>
              <MetricTile label="TTM Turnover" value={ttm === undefined ? '—' : formatInrCompact(ttm)} />
              <MetricTile label="Net Profit" value={formatInrCompact(record.net_profit)} />
              <MetricTile label="Net Worth" value={formatInrCompact(record.net_worth)} />
              <MetricTile
                label="3-Yr Growth"
                value={growth === null ? '—' : `${growth >= 0 ? '+' : ''}${growth}%`}
                tone={growth === null ? undefined : growth >= 0 ? colors.success : colors.danger}
              />
            </View>
          </Panel>

          <Panel
            title={`⚖️ Loans & Liabilities${
              liabilities && liabilities.length ? ` (total: ${formatInrCompact(liabilityTotal)})` : ''
            }`}
          >
            {liabilities === null ? (
              <Muted>Liabilities are not visible with your current access.</Muted>
            ) : liabilities.length === 0 ? (
              <View style={styles.noLiabilities}>
                <Text style={styles.noLiabilitiesText}>
                  ✓ No outstanding loans or liabilities declared
                </Text>
              </View>
            ) : (
              liabilities.map((liability, index) => (
                <View key={`${liability.type}-${index}`} style={styles.liabilityRow}>
                  <Text style={styles.liabilityLabel}>
                    {[liability.type, liability.lender].filter(Boolean).join(' — ') || 'Liability'}
                  </Text>
                  <Text style={styles.liabilityAmount}>
                    {formatInrCompact(Number(liability.amount) || 0)}
                  </Text>
                </View>
              ))
            )}
            <Text style={styles.panelNote}>
              Declared by the company. Verify independently during due diligence.
            </Text>
          </Panel>

          <Panel title="📄 CA-Certified Statements">
            {!hasCaStatements && !unlocked ? (
              <>
                <View style={styles.blurRows} pointerEvents="none">
                  <View style={styles.statementRow}>
                    <Text style={styles.statementLabel}>📄 Balance Sheet FY 2023-24</Text>
                    <Text style={styles.statementBadge}>PDF</Text>
                  </View>
                  <View style={styles.statementRow}>
                    <Text style={styles.statementLabel}>📄 P&amp;L FY 2023-24</Text>
                    <Text style={styles.statementBadge}>PDF</Text>
                  </View>
                </View>
                <View style={styles.lockOverlay}>
                  <Text style={styles.lockTitle}>🔒 Statements locked</Text>
                  <Text style={styles.lockText}>
                    Members can view and download CA-certified statements.
                  </Text>
                  {active ? (
                    <Button title="Unlock with 1 credit" onPress={() => setConfirming(true)} />
                  ) : null}
                </View>
              </>
            ) : !hasCaStatements ? (
              <Muted>No CA-certified statements have been published for this company yet.</Muted>
            ) : (
              <>
                <View style={styles.statementRow}>
                  <Text style={styles.statementLabel}>📄 Balance Sheet — latest 3 FYs</Text>
                  <Text style={styles.statementOk}>PDF ✓</Text>
                </View>
                <View style={styles.statementRow}>
                  <Text style={styles.statementLabel}>📄 Profit &amp; Loss — latest 3 FYs</Text>
                  <Text style={styles.statementOk}>PDF ✓</Text>
                </View>
                <View style={styles.statementCert}>
                  <KeyRow
                    label="Certifying CA"
                    value={caMembership ? `${caName || 'On file'} (ICAI ${caMembership})` : caName || 'On file'}
                  />
                  {caUdin ? <KeyRow label="UDIN" value={caUdin} /> : null}
                </View>
                <Text style={styles.panelNote}>
                  Served via time-limited secure links. Included in research-profile download.
                </Text>
              </>
            )}
          </Panel>

          <Panel title="🏷️ Business Details">
            <KeyRow label="Industry" value={String(record.industry ?? '—')} />
            <KeyRow label="Category" value={String(record.category ?? '—')} />
            <KeyRow label="Location" value={[record.city, record.state, record.country].filter(Boolean).join(', ') || '—'} />
            <KeyRow
              label="Employees"
              value={record.employee_count === undefined ? '—' : String(record.employee_count)}
            />
            <KeyRow label="Annual revenue" value={formatInrCompact(record.annual_revenue)} />
          </Panel>
        </View>

        <View style={styles.columnRight}>
          <Panel title="🏢 Company Identity">
            {unlocked ? (
              <>
                <View style={styles.memberPill}>
                  <Text style={styles.memberPillText}>Member access</Text>
                </View>
                <KeyRow label="Legal name" value={String(record.legal_name ?? '—')} />
                <KeyRow label="Trade name" value={String(record.trade_name ?? '—')} />
                <KeyRow label="CIN / Reg." value={String(record.registration_number ?? 'On file')} />
                <KeyRow label="Email" value={String(record.public_email ?? '—')} />
                <KeyRow label="Phone" value={String(record.public_phone ?? '—')} />
                {record.contact_person_name ? (
                  <KeyRow label="Contact person" value={String(record.contact_person_name)} />
                ) : null}
                <KeyRow
                  label="Address"
                  value={[record.address_line, record.city, record.state, record.postal_code]
                    .filter(Boolean).join(', ') || '—'}
                />
              </>
            ) : (
              <>
                <View style={styles.blurRows} pointerEvents="none">
                  <KeyRow label="Legal name" value="██████████ Pvt Ltd" />
                  <KeyRow label="CIN / Reg." value="U█████████" />
                  <KeyRow label="Email" value="████@████.com" />
                  <KeyRow label="Phone" value="+91 █████ █████" />
                </View>
                <View style={styles.lockOverlay}>
                  <Text style={styles.lockTitle}>🔒 Identity locked</Text>
                  <Text style={styles.lockText}>
                    Unlock this company to view its registered name, CA details and contact
                    information.
                  </Text>
                  {!confirming ? (
                    <Button title="Unlock with 1 credit" onPress={() => setConfirming(true)} />
                  ) : (
                    <View style={styles.confirmRow}>
                      <Button
                        title="Confirm unlock (1 credit)"
                        variant="success"
                        onPress={unlock}
                        loading={unlocking}
                      />
                      <Button title="Cancel" variant="ghost" onPress={() => setConfirming(false)} />
                    </View>
                  )}
                </View>
              </>
            )}
          </Panel>

          <Panel title="🎬 Corporate Profile Video">
            {videoUrl ? (
              <>
                <View style={styles.videoShell}>
                  <View style={styles.playCircle}>
                    <Text style={styles.playGlyph}>▶</Text>
                  </View>
                  <Text style={styles.videoTitle}>{name} — Company Profile</Text>
                  <Text style={styles.videoSub}>Corporate profile · Members only</Text>
                </View>
                <Button
                  title="Watch profile video"
                  onPress={openVideo}
                  style={{ marginTop: spacing.md }}
                />
              </>
            ) : !unlocked ? (
              <>
                <View style={[styles.videoShell, styles.videoShellLocked]}>
                  <Text style={styles.videoLockGlyph}>🔒</Text>
                  <Text style={styles.videoTitle}>Profile video locked</Text>
                  <Text style={styles.videoSub}>
                    Research members can watch the company profile video.
                  </Text>
                </View>
                <Button
                  title={active ? 'Unlock with 1 credit' : 'Get access'}
                  onPress={() => (active ? setConfirming(true) : navigation.navigate('Plans'))}
                  style={{ marginTop: spacing.md }}
                />
              </>
            ) : (
              <Muted>No profile video has been published for this company yet.</Muted>
            )}
          </Panel>

          <Panel title="⬇ Research Access">
            {active ? (
              <View style={styles.creditNote}>
                <Text style={styles.creditText}>
                  You have <Text style={styles.creditStrong}>{credits}</Text> of your plan credits
                  remaining.
                </Text>
              </View>
            ) : (
              <Muted style={{ marginBottom: spacing.sm }}>
                An active research plan is required to unlock company identities.
              </Muted>
            )}
            {unlocked ? (
              <>
                <Text style={styles.unlockedTitle}>✓ Full identity unlocked</Text>
                <Muted style={{ marginTop: spacing.xs }}>
                  Your unlock remains valid while your subscription is active.
                </Muted>
              </>
            ) : active ? (
              <Muted style={{ marginBottom: spacing.md }}>
                Each company counts once. Unlocks stay available for the life of your subscription.
              </Muted>
            ) : (
              <Button title="View plans" onPress={() => navigation.navigate('Plans')} />
            )}
            {!unlocked && active ? (
              <Button
                title="Get more credits"
                variant="ghost"
                small
                onPress={() => navigation.navigate('Plans')}
                style={{ marginTop: spacing.sm }}
              />
            ) : null}
          </Panel>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    marginBottom: spacing.xl - 4,
    flexWrap: 'wrap',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  headText: { flexShrink: 1, flexGrow: 1, flexBasis: 0, minWidth: 240 },
  headName: { fontSize: 22, fontWeight: '800', color: colors.text },
  headMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  tag: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
  tagUnlocked: { backgroundColor: '#E8F7F1' },
  tagUnlockedText: { color: '#0B6B4F' },
  tagCode: { backgroundColor: '#F1F2F7' },
  tagCodeText: { color: '#5A6478' },
  tagSector: { backgroundColor: colors.surfaceMuted },
  tagSectorText: { color: colors.muted },
  researchBanner: {
    backgroundColor: '#EEF2FB',
    borderWidth: 1,
    borderColor: '#CBD7F2',
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  researchBannerText: { color: '#3A4A73', fontSize: 12, lineHeight: 19 },
  researchBannerStrong: { fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl - 4,
    alignItems: 'flex-start',
  },
  columnLeft: { flexGrow: 2, flexShrink: 1, flexBasis: 560, minWidth: 0 },
  columnRight: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0 },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl - 4,
    ...shadows.card,
  },
  panelTitle: { fontSize: 15.5, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  trendCaption: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  captionText: { fontSize: 11, color: colors.muted },
  table: { marginTop: spacing.lg },
  tableRow: { flexDirection: 'row', alignItems: 'center' },
  tableHead: { borderBottomWidth: 2, borderBottomColor: colors.border },
  tableBody: { borderBottomWidth: 1, borderBottomColor: colors.border },
  th: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  td: { fontSize: 13, color: colors.text, paddingVertical: 10, paddingHorizontal: 10 },
  tdBold: { fontWeight: '700' },
  colPeriod: { flex: 1.2 },
  colNum: { flex: 1, textAlign: 'right' },
  description: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 23 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing.lg },
  tile: {
    flexBasis: 130,
    flexGrow: 1,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tileValue: { fontSize: 14.5, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  kvKey: { fontSize: 13.5, color: colors.muted, flexShrink: 1 },
  kvValue: { fontSize: 13.5, fontWeight: '600', color: colors.text, textAlign: 'right', flexShrink: 1 },
  memberPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F7F1',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: spacing.sm,
  },
  memberPillText: { color: '#0B6B4F', fontSize: 12, fontWeight: '700' },
  blurRows: { opacity: 0.55 },
  lockOverlay: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  lockTitle: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  lockText: { fontSize: 12.5, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  confirmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  creditNote: {
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: '#F2DFAC',
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  creditText: { fontSize: 13, color: '#7A5A12' },
  creditStrong: { fontSize: 19, fontWeight: '700', color: colors.primary },
  unlockedTitle: { fontSize: 14.5, fontWeight: '700', color: colors.success },
  videoShell: {
    backgroundColor: '#1E2761',
    borderRadius: radius.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  videoShellLocked: { backgroundColor: '#242B44' },
  playCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  playGlyph: { color: colors.white, fontSize: 17, marginLeft: 3 },
  videoLockGlyph: { fontSize: 24, marginBottom: spacing.xs },
  videoTitle: { color: colors.white, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  videoSub: { color: '#B9C3DC', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  liabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  liabilityLabel: { fontSize: 13, color: colors.text, flexShrink: 1 },
  liabilityAmount: { fontSize: 13, fontWeight: '700', color: colors.text },
  noLiabilities: {
    backgroundColor: '#EAF7F0',
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  noLiabilitiesText: { fontSize: 13, fontWeight: '600', color: '#0B6B4F' },
  panelNote: { fontSize: 11.5, color: colors.muted, marginTop: spacing.sm, lineHeight: 17 },
  statementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  statementLabel: { fontSize: 13, color: colors.text, flexShrink: 1 },
  statementBadge: { fontSize: 12, fontWeight: '600', color: colors.muted },
  statementOk: { fontSize: 12.5, fontWeight: '700', color: colors.success },
  statementCert: { marginTop: spacing.md },
});
