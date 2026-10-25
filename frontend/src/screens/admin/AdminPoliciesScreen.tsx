import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchPolicyFields, previewPolicy, updatePolicyFields } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { Access, PolicyRow } from '../../api/types';
import {
  Badge,
  Banner,
  Button,
  Card,
  ChoiceRow,
  Divider,
  EmptyState,
  Field,
  Loading,
  Muted,
  Screen,
  SectionTitle,
  Title,
} from '../../components/ui';
import { humanizeField, titleCase } from '../../lib/format';
import { colors, spacing, typography } from '../../theme';

const ACCESS_ORDER: Access[] = ['hidden', 'masked', 'read', 'write'];

function toneFor(access: Access) {
  switch (access) {
    case 'write':
      return 'success' as const;
    case 'read':
      return 'info' as const;
    case 'masked':
      return 'warning' as const;
    default:
      return 'danger' as const;
  }
}

export default function AdminPoliciesScreen() {
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState('researcher');
  const [stateFilter, setStateFilter] = useState('locked');
  const [changes, setChanges] = useState<Record<string, Access>>({});
  const [previewRole, setPreviewRole] = useState('researcher');
  const [previewState, setPreviewState] = useState('locked');
  const [previewUserId, setPreviewUserId] = useState('');
  const [preview, setPreview] = useState<Record<string, string> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchPolicyFields());
      setChanges({});
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const keyOf = (row: PolicyRow) => `${row.role}|${row.unlockState}|${row.field}`;

  const visible = useMemo(() => rows
    .filter((row) => (roleFilter === 'all' || row.role === roleFilter))
    .filter((row) => (stateFilter === 'all' || row.unlockState === stateFilter))
    .sort((a, b) => a.field.localeCompare(b.field)), [rows, roleFilter, stateFilter]);

  const accessOf = (row: PolicyRow): Access => changes[keyOf(row)] ?? row.access;

  const cycle = (row: PolicyRow) => {
    const current = accessOf(row);
    const next = ACCESS_ORDER[(ACCESS_ORDER.indexOf(current) + 1) % ACCESS_ORDER.length];
    setChanges((existing) => ({ ...existing, [keyOf(row)]: next }));
  };

  const save = async () => {
    const entries = Object.entries(changes);
    if (!entries.length) {
      setMessage('No changes to save.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const policies = entries.map(([key, access]) => {
        const [role, unlockState, field] = key.split('|');
        return { role, resource: 'business', field, access, unlockState };
      });
      setRows(await updatePolicyFields(policies));
      setChanges({});
      setMessage(`Updated ${policies.length} field polic${policies.length === 1 ? 'y' : 'ies'}.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    setError(null);
    try {
      const response = await previewPolicy({
        role: previewRole,
        state: previewState,
        userId: previewUserId.trim() || undefined,
      });
      setPreview(response.fields);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  return (
    <Screen topInset={false}>
      <Title subtitle="Field-level visibility is default-deny. Tap an access badge to cycle hidden → masked → read → write, then save.">
        Visibility policies
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}

      <Card>
        <ChoiceRow
          label="Role"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'researcher', label: 'Researcher' },
            { value: 'business', label: 'Business' },
            { value: 'auditor', label: 'Auditor' },
            { value: 'admin', label: 'Admin' },
            { value: 'all', label: 'All' },
          ]}
        />
        <ChoiceRow
          label="Unlock state"
          value={stateFilter}
          onChange={setStateFilter}
          options={[
            { value: 'locked', label: 'Locked' },
            { value: 'unlocked', label: 'Unlocked' },
            { value: 'any', label: 'Any' },
            { value: 'all', label: 'All' },
          ]}
        />
        <Muted>{Object.keys(changes).length} unsaved change(s)</Muted>
        <View style={styles.actions}>
          <Button title="Save policy changes" onPress={save} loading={saving} disabled={saving} />
          <Button title="Discard changes" variant="ghost" onPress={() => setChanges({})} />
        </View>
      </Card>

      <SectionTitle>Field matrix</SectionTitle>
      {loading ? <Loading /> : visible.length === 0 ? (
        <EmptyState title="No policies" message="No field policies match this filter." />
      ) : (
        <Card>
          {visible.map((row, index) => (
            <View key={row.id ?? `${keyOf(row)}`}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.policyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.body}>{humanizeField(row.field)}</Text>
                  <Muted>{titleCase(row.role)} · {titleCase(row.unlockState)}</Muted>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${humanizeField(row.field)}: ${accessOf(row)}. Activate to change access.`}
                  onPress={() => cycle(row)}
                >
                  <Badge label={accessOf(row)} tone={toneFor(accessOf(row))} />
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
      )}

      <SectionTitle>Effective access preview</SectionTitle>
      <Card>
        <ChoiceRow
          label="Role"
          value={previewRole}
          onChange={setPreviewRole}
          options={[
            { value: 'researcher', label: 'Researcher' },
            { value: 'business', label: 'Business' },
            { value: 'auditor', label: 'Auditor' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
        <ChoiceRow
          label="Unlock state"
          value={previewState}
          onChange={setPreviewState}
          options={[
            { value: 'locked', label: 'Locked' },
            { value: 'unlocked', label: 'Unlocked' },
            { value: 'any', label: 'Any' },
          ]}
        />
        <Field
          label="User ID (optional)"
          value={previewUserId}
          onChangeText={setPreviewUserId}
          placeholder="Include per-user overrides"
          autoCapitalize="none"
        />
        <Button title="Preview access" variant="secondary" onPress={runPreview} />
        {preview ? (
          <View style={{ marginTop: spacing.md }}>
            {Object.entries(preview).sort(([a], [b]) => a.localeCompare(b)).map(([field, access]) => (
              <View key={field} style={styles.policyRow}>
                <Text style={typography.small}>{humanizeField(field)}</Text>
                <Badge label={access} tone={toneFor(access as Access)} />
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Muted style={{ color: colors.muted, marginTop: spacing.sm }}>
        The default for any field without a policy is hidden. Overrides can be managed from a user’s
        detail screen.
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  policyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
});
