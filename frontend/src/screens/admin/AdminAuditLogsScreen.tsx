import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { exportAuditLogs, fetchAuditLogs } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { AuditLogEntry, PageResult } from '../../api/types';
import {
  Badge,
  Banner,
  Button,
  Card,
  ChoiceRow,
  EmptyState,
  Field,
  Loading,
  Muted,
  Pager,
  Screen,
  Title,
} from '../../components/ui';
import { formatDateTime, titleCase } from '../../lib/format';
import { colors, spacing, typography } from '../../theme';

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

function jsonPreview(value: unknown): string {
  if (value === null || value === undefined) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminAuditLogsScreen() {
  const [result, setResult] = useState<PageResult<AuditLogEntry> | null>(null);
  const [page, setPage] = useState(0);
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [applied, setApplied] = useState<{ action: string; resourceType: string }>({ action: '', resourceType: '' });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchAuditLogs({
        action: applied.action || undefined,
        resourceType: applied.resourceType || undefined,
        page,
        size: 25,
      }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setPage(0);
    setApplied({ action: action.trim(), resourceType: resourceType.trim() });
  };

  const exportCsv = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const blob = await exportAuditLogs({
        action: applied.action || undefined,
        resourceType: applied.resourceType || undefined,
      });
      if (downloadBlob(blob, 'audit-log.csv')) {
        setMessage('Audit log export downloaded.');
      } else {
        setMessage('CSV export is available in the web build.');
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen topInset={false}>
      <Title subtitle="Append-only record of security-relevant actions. Newest entries first.">
        Audit trail
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}

      <Card>
        <Field
          label="Action contains"
          value={action}
          onChangeText={setAction}
          placeholder="e.g. USER_APPROVED, POLICY"
          autoCapitalize="characters"
        />
        <ChoiceRow
          label="Resource type"
          value={resourceType}
          onChange={setResourceType}
          options={[
            { value: '', label: 'All' },
            { value: 'user', label: 'User' },
            { value: 'business', label: 'Business' },
            { value: 'document', label: 'Document' },
            { value: 'subscription', label: 'Subscription' },
            { value: 'listing', label: 'Listing' },
            { value: 'payment', label: 'Payment' },
            { value: 'field_policy', label: 'Field policy' },
          ]}
        />
        <View style={styles.actions}>
          <Button title="Apply filters" onPress={applyFilters} />
          <Button
            title="Reset"
            variant="ghost"
            onPress={() => {
              setAction('');
              setResourceType('');
              setApplied({ action: '', resourceType: '' });
              setPage(0);
            }}
          />
          <Button title="Export CSV" variant="secondary" onPress={exportCsv} loading={busy} disabled={busy} />
        </View>
      </Card>

      {loading ? <Loading /> : result && result.items.length ? (
        <>
          {result.items.map((entry) => {
            const open = expanded === entry.id;
            return (
              <Card key={entry.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={`${entry.action} details`}
                  onPress={() => setExpanded(open ? null : entry.id)}
                >
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.h3}>{entry.action}</Text>
                      <Muted>
                        {entry.resourceType ? titleCase(entry.resourceType) : 'System'}
                        {entry.resourceId ? ` · ${entry.resourceId}` : ''}
                      </Muted>
                      <Muted>{formatDateTime(entry.createdAt)}</Muted>
                    </View>
                    <Badge label={open ? 'Hide' : 'Details'} tone="info" />
                  </View>
                </Pressable>
                {entry.actorUserId ? <Muted>Actor {entry.actorUserId}</Muted> : null}
                {open ? (
                  <View style={{ marginTop: spacing.md }}>
                    {entry.ip ? <Muted>IP {entry.ip}</Muted> : null}
                    <Text style={[typography.label, { marginTop: spacing.md }]}>Before</Text>
                    <Text style={styles.code}>{jsonPreview(entry.before)}</Text>
                    <Text style={[typography.label, { marginTop: spacing.md }]}>After</Text>
                    <Text style={styles.code}>{jsonPreview(entry.after)}</Text>
                  </View>
                ) : null}
              </Card>
            );
          })}
          <Pager page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} />
        </>
      ) : (
        <EmptyState title="No audit entries" message="No entries match the current filters." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  code: {
    ...typography.mono,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 6,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
});
