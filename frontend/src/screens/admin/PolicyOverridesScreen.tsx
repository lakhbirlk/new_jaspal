import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import {
  deleteUserOverride,
  fetchUserOverrides,
  updateUserOverrides,
} from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { Access, PolicyOverride } from '../../api/types';
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
import { formatDate, humanizeField, titleCase } from '../../lib/format';
import type { AdminStackParamList } from '../../navigation/types';
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

function toInstant(value: string): string | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T23:59:59Z` : trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export default function PolicyOverridesScreen() {
  const route = useRoute<RouteProp<AdminStackParamList, 'PolicyOverrides'>>();
  const { userId, email } = route.params;

  const [overrides, setOverrides] = useState<PolicyOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [field, setField] = useState('');
  const [access, setAccess] = useState<Access>('read');
  const [state, setState] = useState('any');
  const [expiresAt, setExpiresAt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverrides(await fetchUserOverrides(userId));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async (
    key: string,
    override: { resource: string; field: string; access: string; unlockState?: string; expiresAt?: string | null },
    success: string,
  ) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      setOverrides(await updateUserOverrides(userId, [override]));
      setMessage(success);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const cycle = (override: PolicyOverride) => {
    const next = ACCESS_ORDER[(ACCESS_ORDER.indexOf(override.access) + 1) % ACCESS_ORDER.length];
    return apply(
      `cycle-${override.id}`,
      {
        resource: override.resource,
        field: override.field,
        access: next,
        unlockState: override.unlockState,
        expiresAt: override.expiresAt ?? null,
      },
      `${humanizeField(override.field)} set to ${next}.`,
    );
  };

  const remove = async (override: PolicyOverride) => {
    setBusy(`delete-${override.id}`);
    setError(null);
    setMessage(null);
    try {
      await deleteUserOverride(userId, override.id);
      setMessage('Override removed. The user falls back to role defaults.');
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    if (!field.trim()) {
      setError('Enter the business field this override applies to.');
      return;
    }
    const expires = toInstant(expiresAt);
    if (expires === undefined) {
      setError('Expiry must be a date (YYYY-MM-DD) or an ISO timestamp.');
      return;
    }
    await apply(
      'add',
      {
        resource: 'business',
        field: field.trim(),
        access,
        unlockState: state,
        expiresAt: expires,
      },
      `Override added for ${humanizeField(field.trim())}.`,
    );
    setField('');
    setExpiresAt('');
    setShowForm(false);
  };

  return (
    <Screen topInset={false}>
      <Title subtitle={email ? `Per-user field access for ${email}. Overrides win over role policies until they expire.` : 'Per-user field access overrides.'}>
        User policy overrides
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}

      <Card>
        <Muted>User ID</Muted>
        <Text style={typography.mono}>{userId}</Text>
        <View style={{ height: spacing.sm }} />
        <Button
          title={showForm ? 'Close form' : 'Add an override'}
          variant={showForm ? 'ghost' : 'primary'}
          onPress={() => setShowForm((open) => !open)}
        />
      </Card>

      {showForm ? (
        <Card>
          <Text style={typography.h3}>New override</Text>
          <View style={{ height: spacing.md }} />
          <Field
            label="Business field"
            value={field}
            onChangeText={setField}
            placeholder="e.g. bank_details"
            autoCapitalize="none"
            required
            hint="Use the API field name. Overrides only apply to the business resource."
          />
          <ChoiceRow
            label="Access"
            value={access}
            onChange={(value) => setAccess(value as Access)}
            options={ACCESS_ORDER.map((value) => ({ value, label: titleCase(value) }))}
          />
          <ChoiceRow
            label="Unlock state"
            value={state}
            onChange={setState}
            options={[
              { value: 'any', label: 'Any' },
              { value: 'locked', label: 'Locked' },
              { value: 'unlocked', label: 'Unlocked' },
            ]}
          />
          <Field
            label="Expires at"
            value={expiresAt}
            onChangeText={setExpiresAt}
            placeholder="2026-12-31 (optional)"
            autoCapitalize="none"
            hint="Leave blank for a permanent override."
          />
          <View style={styles.actions}>
            <Button title="Save override" onPress={add} loading={busy === 'add'} disabled={busy === 'add'} />
            <Button title="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
          </View>
        </Card>
      ) : null}

      <SectionTitle>Active overrides</SectionTitle>
      {loading ? <Loading /> : overrides.length === 0 ? (
        <EmptyState
          title="No overrides"
          message="This user receives the default access defined by their role and unlock state."
        />
      ) : (
        <Card>
          {overrides.map((override, index) => {
            return (
              <View key={override.id}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h3}>{humanizeField(override.field)}</Text>
                    <Muted>
                      {titleCase(override.resource)} · {titleCase(override.unlockState)}
                      {override.expiresAt ? ` · expires ${formatDate(override.expiresAt)}` : ' · permanent'}
                    </Muted>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${humanizeField(override.field)}: ${override.access}. Activate to change access.`}
                    disabled={busy === `cycle-${override.id}`}
                    onPress={() => cycle(override)}
                  >
                    <Badge label={override.access} tone={toneFor(override.access)} />
                  </Pressable>
                </View>
                <View style={styles.actions}>
                  <Button
                    title="Cycle access"
                    variant="secondary"
                    small
                    loading={busy === `cycle-${override.id}`}
                    onPress={() => cycle(override)}
                  />
                  <Button
                    title="Remove"
                    variant="danger"
                    small
                    loading={busy === `delete-${override.id}`}
                    onPress={() => remove(override)}
                  />
                </View>
              </View>
            );
          })}
        </Card>
      )}

      <Muted style={{ color: colors.muted, marginTop: spacing.sm }}>
        Overrides are audited. Removing one immediately restores the role-based policy.
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
