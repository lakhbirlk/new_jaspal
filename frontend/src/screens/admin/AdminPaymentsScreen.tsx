import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  exportPaymentTransactions,
  fetchPaymentAnalytics,
  fetchPaymentDashboardMetrics,
  fetchPaymentTransactionDetails,
  fetchPaymentTransactions,
  recordOfflinePayment,
  refundPayment,
} from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type {
  PageResult,
  PaymentAnalytics,
  PaymentDashboardMetrics,
  PaymentTransaction,
  PaymentTransactionDetail,
  RevenueWindow,
} from '../../api/types';
import {
  Badge,
  Banner,
  Button,
  Card,
  ChoiceRow,
  EmptyState,
  Field,
  KeyValue,
  Loading,
  Muted,
  Pager,
  Screen,
  SectionTitle,
  Title,
} from '../../components/ui';
import { formatDateTime, formatMoney, statusTone, titleCase } from '../../lib/format';
import { colors, radius, spacing, typography } from '../../theme';

type Period = 'daily' | 'weekly' | 'monthly' | 'custom';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

/** Browser-only CSV download; mirrors the audit-log export helper. */
function downloadBlob(blob: Blob, filename: string): boolean {
  if (Platform.OS !== 'web') return false;
  const scope = globalThis as unknown as {
    URL?: { createObjectURL: (blob: Blob) => string; revokeObjectURL: (url: string) => void };
    document?: {
      createElement: (tag: string) => {
        href: string;
        download: string;
        click: () => void;
        remove: () => void;
      };
      body?: { appendChild: (node: unknown) => void };
    };
  };
  if (!scope.URL || !scope.document?.body) return false;
  const url = scope.URL.createObjectURL(blob);
  const anchor = scope.document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  scope.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => scope.URL?.revokeObjectURL(url), 30_000);
  return true;
}

const WINDOW_LABELS: Record<RevenueWindow, string> = {
  total: 'Total revenue',
  today: "Today's revenue",
  week: "This week's revenue",
  month: "This month's revenue",
};

/** Render one line per currency so amounts are never added across currencies. */
function RevenueValue({
  amounts,
  tone,
  emptyLabel = '—',
}: {
  amounts: Record<string, number> | undefined;
  tone?: string;
  emptyLabel?: string;
}) {
  const entries = Object.entries(amounts ?? {});
  if (!entries.length) {
    return <Text style={[styles.metricValue, { color: colors.muted }]}>{emptyLabel}</Text>;
  }
  return (
    <View>
      {entries.map(([currency, amount]) => (
        <Text key={currency} style={[styles.metricValue, tone ? { color: tone } : undefined]}>
          {formatMoney(amount, currency)}
        </Text>
      ))}
    </View>
  );
}

function MetricCard({
  label,
  amounts,
  value,
  tone,
  subtitle,
  emptyLabel,
}: {
  label: string;
  amounts?: Record<string, number>;
  value?: number;
  tone?: string;
  subtitle?: string;
  emptyLabel?: string;
}) {
  return (
    <Card style={styles.metricCard}>
      {amounts ? (
        <RevenueValue amounts={amounts} tone={tone} emptyLabel={emptyLabel} />
      ) : (
        <Text style={[styles.metricValue, tone ? { color: tone } : undefined]}>{value ?? 0}</Text>
      )}
      <Text style={typography.small}>{label}</Text>
      {subtitle ? <Muted style={{ marginTop: spacing.xs }}>{subtitle}</Muted> : null}
    </Card>
  );
}

function shortLabel(point: { label: string; bucketStart: string }, granularity: string): string {
  if (granularity === 'month') return point.bucketStart.slice(0, 7);
  return point.bucketStart.slice(5);
}

function RevenueChart({ data }: { data: PaymentAnalytics | null }) {
  if (!data || !data.points.length) {
    return (
      <Card style={styles.chartEmpty}>
        <Muted>No revenue recorded for this period.</Muted>
      </Card>
    );
  }

  const amounts = data.points.map((point) => point.amount);
  const max = Math.max(...amounts, 0);
  const best = data.points.reduce((acc, point) => (point.amount > acc.amount ? point : acc), data.points[0]);
  const average = amounts.reduce((sum, amount) => sum + amount, 0) / data.points.length;
  const currency = data.currency ?? undefined;
  const chartHeight = 132;
  const hasRevenue = max > 0;

  return (
    <Card style={{ paddingHorizontal: spacing.sm }}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Revenue by {data.granularity}</Text>
        <Muted>
          {data.start} → {data.end}
        </Muted>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chartPlot}>
          {data.points.map((point, index) => {
            const height = hasRevenue ? Math.max((point.amount / max) * chartHeight, point.amount > 0 ? 3 : 0) : 0;
            return (
              <View key={`${point.bucketStart}-${index}`} style={styles.barColumn}>
                <View
                  accessibilityLabel={`${point.label}: ${formatMoney(point.amount, currency)}`}
                  style={[styles.bar, { height, backgroundColor: point.amount > 0 ? colors.primary : colors.border }]}
                />
                <Muted style={styles.barLabel}>{shortLabel(point, data.granularity)}</Muted>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.chartSummary}>
        <View>
          <Muted>Period total</Muted>
          <Text style={typography.h3}>{formatMoney(data.totalRevenue, currency)}</Text>
        </View>
        <View>
          <Muted>Best {data.granularity}</Muted>
          <Text style={typography.h3}>{formatMoney(best.amount, currency)}</Text>
          <Muted>{best.label}</Muted>
        </View>
        <View>
          <Muted>Average</Muted>
          <Text style={typography.h3}>{formatMoney(average, currency)}</Text>
        </View>
      </View>
    </Card>
  );
}

export default function AdminPaymentsScreen() {
  const [tab, setTab] = useState<'overview' | 'transactions'>('overview');

  // overview
  const [metrics, setMetrics] = useState<PaymentDashboardMetrics | null>(null);
  const [analytics, setAnalytics] = useState<PaymentAnalytics | null>(null);
  const [period, setPeriod] = useState<Period>('daily');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [currency, setCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // transactions
  const [rows, setRows] = useState<PageResult<PaymentTransaction> | null>(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
  const [gateway, setGateway] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<'createdAt' | 'paidAt' | 'amount' | 'status'>('createdAt');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [txLoading, setTxLoading] = useState(false);

  // detail + actions
  const [detail, setDetail] = useState<PaymentTransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [providerRef, setProviderRef] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    // A custom window is only queried once the admin applies a complete range.
    if (period === 'custom' && (!range.from || !range.to)) return;
    setLoading(true);
    setError(null);
    try {
      const params =
        period === 'custom'
          ? { period, from: range.from, to: range.to }
          : { period };
      const [nextMetrics, nextAnalytics] = await Promise.all([
        fetchPaymentDashboardMetrics(),
        fetchPaymentAnalytics({ ...params, currency: currency ?? undefined }),
      ]);
      setMetrics(nextMetrics);
      setAnalytics(nextAnalytics);
      if (!currency && nextAnalytics.currency) {
        setCurrency(nextAnalytics.currency);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [period, range, currency]);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    setError(null);
    try {
      setRows(
        await fetchPaymentTransactions({
          page,
          size: 20,
          status: status || undefined,
          gateway: gateway.trim() || undefined,
          search: search.trim() || undefined,
          dateFrom: dateFrom.trim() || undefined,
          dateTo: dateTo.trim() || undefined,
          sort,
          direction,
        }),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setTxLoading(false);
    }
  }, [page, status, gateway, search, dateFrom, dateTo, sort, direction]);

  useFocusEffect(
    useCallback(() => {
      void loadOverview();
    }, [loadOverview]),
  );

  useEffect(() => {
    if (tab === 'transactions') void loadTransactions();
  }, [tab, loadTransactions]);

  const openDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setError(null);
    setProviderRef('');
    setRefundReason('');
    try {
      setDetail(await fetchPaymentTransactionDetails(id));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const runAction = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      setNotice(message);
      setTimeout(() => setNotice(null), 4000);
      const id = detail?.id;
      await Promise.all([loadOverview(), loadTransactions()]);
      if (id) await openDetail(id);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = useCallback(async () => {
    try {
      const blob = await exportPaymentTransactions({
        status: status || undefined,
        gateway: gateway.trim() || undefined,
        search: search.trim() || undefined,
        dateFrom: dateFrom.trim() || undefined,
        dateTo: dateTo.trim() || undefined,
      });
      if (!downloadBlob(blob, 'payment-transactions.csv')) {
        setError('CSV export is available in the web app.');
        return;
      }
      setNotice('Export started. Check your downloads.');
      setTimeout(() => setNotice(null), 4000);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [status, gateway, search, dateFrom, dateTo]);

  const currencyOptions = useMemo(
    () => (analytics?.currencies ?? metrics?.currencies ?? []).map((code) => ({ value: code, label: code })),
    [analytics, metrics],
  );

  const updateFilter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(0);
  };

  return (
    <Screen>
      <Title subtitle="Revenue collected, transaction health and the full payment log. Figures are aggregated from confirmed payment records.">
        Payments
      </Title>

      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}

      <View style={styles.tabs}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'overview' }}
          style={[styles.tab, tab === 'overview' && styles.tabActive]}
          onPress={() => setTab('overview')}
        >
          <Text style={[styles.tabText, tab === 'overview' && styles.tabTextActive]}>Overview</Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'transactions' }}
          style={[styles.tab, tab === 'transactions' && styles.tabActive]}
          onPress={() => setTab('transactions')}
        >
          <Text style={[styles.tabText, tab === 'transactions' && styles.tabTextActive]}>
            Transactions
          </Text>
        </Pressable>
      </View>

      {tab === 'overview' ? (
        loading && !metrics ? (
          <Loading label="Loading revenue…" />
        ) : (
          <>
            <SectionTitle>Revenue</SectionTitle>
            <View style={styles.grid}>
              {(Object.keys(WINDOW_LABELS) as RevenueWindow[]).map((window) => (
                <MetricCard
                  key={window}
                  label={WINDOW_LABELS[window]}
                  amounts={metrics?.revenueByCurrency?.[window]}
                  tone={window === 'total' ? colors.success : undefined}
                />
              ))}
            </View>

            <SectionTitle>Transactions</SectionTitle>
            <View style={styles.grid}>
              <MetricCard label="Total transactions" value={metrics?.totalTransactions ?? 0} />
              <MetricCard
                label="Successful"
                value={metrics?.successfulPayments ?? 0}
                subtitle={`${metrics?.successRate ?? 0}% of attempted`}
                tone={colors.success}
              />
              <MetricCard label="Failed" value={metrics?.failedPayments ?? 0} tone={colors.danger} />
              <MetricCard label="Pending" value={metrics?.pendingPayments ?? 0} tone={colors.warning} />
              <MetricCard label="Refunded" value={metrics?.refundedPayments ?? 0} />
            </View>

            <SectionTitle>Revenue analytics</SectionTitle>
            <Card>
              <View style={styles.pills}>
                {PERIODS.map((option) => (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: period === option.value }}
                    style={[styles.pill, period === option.value && styles.pillActive]}
                    onPress={() => setPeriod(option.value)}
                  >
                    <Text style={[styles.pillText, period === option.value && styles.pillTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {period === 'custom' ? (
                <>
                  <View style={styles.customRange}>
                    <Field
                      label="From"
                      value={customFrom}
                      onChangeText={setCustomFrom}
                      placeholder="yyyy-mm-dd"
                      style={styles.dateInput}
                    />
                    <Field
                      label="To"
                      value={customTo}
                      onChangeText={setCustomTo}
                      placeholder="yyyy-mm-dd"
                      style={styles.dateInput}
                    />
                  </View>
                  {!range.from || !range.to ? (
                    <Muted style={styles.rangeHint}>
                      Enter both dates, then apply the range.
                    </Muted>
                  ) : null}
                </>
              ) : null}

              {currencyOptions.length > 1 ? (
                <ChoiceRow
                  label="Currency"
                  value={currency ?? currencyOptions[0].value}
                  onChange={(value) => setCurrency(value)}
                  options={currencyOptions}
                />
              ) : null}

              <Button
                title={period === 'custom' ? 'Apply date range' : 'Refresh'}
                variant="secondary"
                small
                loading={loading}
                onPress={() => {
                  if (period === 'custom') {
                    setRange({
                      from: customFrom.trim() || undefined,
                      to: customTo.trim() || undefined,
                    });
                  } else {
                    void loadOverview();
                  }
                }}
              />
            </Card>

            <RevenueChart data={analytics} />

            <Muted style={styles.note}>
              Revenue counts confirmed payments only. Refunded payments are excluded; pending and
              failed attempts are never included.
            </Muted>
          </>
        )
      ) : (
        <>
          <SectionTitle>Filters</SectionTitle>
          <Card>
            <ChoiceRow
              label="Status"
              value={status}
              onChange={updateFilter(setStatus)}
              options={[
                { value: '', label: 'All' },
                { value: 'paid', label: 'Paid' },
                { value: 'pending', label: 'Pending' },
                { value: 'failed', label: 'Failed' },
                { value: 'refunded', label: 'Refunded' },
              ]}
            />
            <Field
              label="Search"
              value={search}
              onChangeText={updateFilter(setSearch)}
              placeholder="Transaction ID, order ID, customer, gateway reference"
              autoCapitalize="none"
            />
            <View style={styles.customRange}>
              <Field
                label="From"
                value={dateFrom}
                onChangeText={updateFilter(setDateFrom)}
                placeholder="yyyy-mm-dd"
                style={styles.dateInput}
              />
              <Field
                label="To"
                value={dateTo}
                onChangeText={updateFilter(setDateTo)}
                placeholder="yyyy-mm-dd"
                style={styles.dateInput}
              />
            </View>
            <Field
              label="Gateway"
              value={gateway}
              onChangeText={updateFilter(setGateway)}
              placeholder="MANUAL"
              autoCapitalize="characters"
            />
            <View style={styles.filterActions}>
              <Button
                title="Clear"
                variant="ghost"
                small
                onPress={() => {
                  setStatus('');
                  setSearch('');
                  setDateFrom('');
                  setDateTo('');
                  setGateway('');
                  setPage(0);
                }}
              />
              <Button title="Apply filters" variant="secondary" small onPress={() => { setPage(0); void loadTransactions(); }} />
              <Button title="Export CSV" variant="primary" small onPress={() => { void exportCsv(); }} />
            </View>
          </Card>

          <View style={styles.sortRow}>
            <Muted>Sort</Muted>
            <ChoiceRow
              label=""
              value={sort}
              onChange={(value) => { setSort(value as typeof sort); setPage(0); }}
              options={[
                { value: 'createdAt', label: 'Date' },
                { value: 'amount', label: 'Amount' },
                { value: 'status', label: 'Status' },
                { value: 'paidAt', label: 'Paid at' },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => { setDirection(direction === 'desc' ? 'asc' : 'desc'); setPage(0); }}
            >
              <Text style={styles.direction}>{direction === 'desc' ? '↓ Desc' : '↑ Asc'}</Text>
            </Pressable>
          </View>

          {txLoading ? (
            <Loading label="Loading transactions…" />
          ) : rows && rows.items.length ? (
            <>
              {rows.items.map((row) => (
                <Card key={row.id} onPress={() => { void openDetail(row.id); }}>
                  <View style={styles.rowHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowAmount}>{formatMoney(row.amount, row.currency)}</Text>
                      <Text style={typography.small} numberOfLines={1}>
                        {row.customerName ?? 'Unknown customer'}
                        {row.customerEmail ? ` · ${row.customerEmail}` : ''}
                      </Text>
                      <Text style={typography.small} numberOfLines={1}>
                        {titleCase(row.purpose)} · {row.gateway ?? row.provider} · {formatDateTime(row.createdAt)}
                      </Text>
                      <Text style={[typography.small, styles.mono]} numberOfLines={1}>
                        {row.id}
                      </Text>
                    </View>
                    <Badge label={titleCase(row.status)} tone={statusTone(row.status)} />
                  </View>
                </Card>
              ))}
              <Pager page={rows.page} totalPages={rows.totalPages} total={rows.total} onPage={setPage} />
            </>
          ) : (
            <EmptyState
              title="No transactions"
              message="No payment records match these filters. Clear the filters to see the full log."
            />
          )}
        </>
      )}

      <Modal
        visible={detail !== null || detailLoading}
        animationType="slide"
        transparent
        onRequestClose={() => setDetail(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={typography.h2}>Transaction details</Text>
                <Pressable accessibilityRole="button" onPress={() => setDetail(null)} hitSlop={8}>
                  <Text style={styles.close}>×</Text>
                </Pressable>
              </View>

              {detailLoading ? <Loading label="Loading transaction…" /> : detail ? (
                <>
                  <View style={styles.badgeRow}>
                    <Badge label={titleCase(detail.status)} tone={statusTone(detail.status)} />
                    <Muted>{titleCase(detail.purpose)}</Muted>
                  </View>

                  <SectionTitle>Payment</SectionTitle>
                  <KeyValue label="Transaction ID" value={detail.id} mono />
                  <KeyValue label="Order ID" value={detail.orderId ?? '—'} mono />
                  <KeyValue label="Amount" value={formatMoney(detail.amount, detail.currency)} />
                  <KeyValue label="Currency" value={detail.currency} />
                  <KeyValue label="Gateway" value={detail.gateway ?? detail.provider} />
                  <KeyValue label="Gateway reference" value={detail.providerRef ?? '—'} mono />

                  <SectionTitle>Customer</SectionTitle>
                  <KeyValue label="Name" value={detail.customerName ?? '—'} />
                  <KeyValue label="Email" value={detail.customerEmail ?? '—'} />
                  <KeyValue label="Customer ID" value={detail.userId ?? '—'} mono />

                  <SectionTitle>Timeline</SectionTitle>
                  <KeyValue label="Created" value={formatDateTime(detail.createdAt)} />
                  <KeyValue label="Paid" value={detail.paidAt ? formatDateTime(detail.paidAt) : '—'} />
                  <KeyValue
                    label="Refunded"
                    value={detail.refund?.refundedAt ? formatDateTime(detail.refund.refundedAt) : '—'}
                  />

                  <SectionTitle>Gateway response</SectionTitle>
                  <KeyValue label="Status" value={titleCase(detail.gatewayResponse?.status ?? detail.status)} />
                  <KeyValue label="Reference" value={detail.gatewayResponse?.reference ?? '—'} mono />
                  {detail.failureReason || detail.gatewayResponse?.failureReason ? (
                    <KeyValue
                      label="Failure reason"
                      value={detail.failureReason ?? detail.gatewayResponse?.failureReason ?? '—'}
                    />
                  ) : null}

                  {detail.refund ? (
                    <>
                      <SectionTitle>Refund</SectionTitle>
                      <KeyValue label="Type" value={titleCase(detail.refund.type)} />
                      <KeyValue
                        label="Amount"
                        value={formatMoney(detail.refund.amount, detail.refund.currency)}
                      />
                      <KeyValue label="Reason" value={detail.refund.reason ?? '—'} />
                    </>
                  ) : null}

                  <Muted style={styles.note}>
                    Card numbers, CVVs, passwords and gateway credentials are never stored or shown.
                  </Muted>

                  {detail.status === 'pending' ? (
                    <>
                      <SectionTitle>Confirm payment</SectionTitle>
                      <Field
                        label="Provider reference"
                        value={providerRef}
                        onChangeText={setProviderRef}
                        placeholder="Receipt or gateway transaction ID"
                      />
                      <Button
                        title="Mark as paid"
                        variant="success"
                        small
                        loading={busy === 'pay'}
                        onPress={() =>
                          runAction(
                            'pay',
                            () => recordOfflinePayment({ paymentId: detail.id, providerRef: providerRef || undefined }),
                            'Payment recorded as paid.',
                          )
                        }
                      />
                    </>
                  ) : null}

                  {detail.status === 'paid' ? (
                    <>
                      <SectionTitle>Refund payment</SectionTitle>
                      <Field
                        label="Reason"
                        value={refundReason}
                        onChangeText={setRefundReason}
                        placeholder="Reason is stored in the audit trail"
                      />
                      <Button
                        title="Refund"
                        variant="danger"
                        small
                        disabled={!refundReason.trim()}
                        loading={busy === 'refund'}
                        onPress={() =>
                          runAction(
                            'refund',
                            () => refundPayment(detail.id, refundReason.trim()),
                            'Payment refunded.',
                          )
                        }
                      />
                    </>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: colors.primaryDark },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    marginBottom: 0,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  metricValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  pillTextActive: { color: colors.primaryDark },
  customRange: { flexDirection: 'row', gap: spacing.sm },
  rangeHint: { marginTop: -spacing.sm, marginBottom: spacing.sm },
  dateInput: { flex: 1 },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  chartTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  chartPlot: { flexDirection: 'row', alignItems: 'flex-end', height: 168, paddingTop: spacing.sm },
  barColumn: { width: 28, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 16, borderRadius: 3, minHeight: 0 },
  barLabel: { fontSize: 9, marginTop: spacing.xs },
  chartEmpty: { alignItems: 'center', paddingVertical: spacing.xl },
  chartSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  note: { marginTop: spacing.md, marginBottom: spacing.lg },
  filterActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  direction: { fontSize: 13, fontWeight: '700', color: colors.primary },
  rowHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowAmount: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 2 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  close: { fontSize: 26, fontWeight: '700', color: colors.textSecondary, lineHeight: 28 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
});
