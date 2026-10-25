import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  deleteProfileRequirement,
  fetchProfileRequirements,
  fetchSettings,
  updateProfileRequirements,
  updateSettings,
} from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { ProfileRequirement, SettingsMap } from '../../api/types';
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
import { titleCase } from '../../lib/format';
import { colors, spacing, typography } from '../../theme';

const KNOWN_KEYS: Record<string, string> = {
  'password.min.length': 'Minimum password length (10 or more).',
  'login.max.failures': 'Failed sign-in attempts before a temporary lock.',
  'login.lock.minutes': 'Lock duration in minutes.',
  'mfa.required.roles': 'Comma-separated roles required to enrol in MFA. Administrators are always exempt.',
};

export default function AdminSettingsScreen() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [edited, setEdited] = useState<SettingsMap>({});
  const [requirements, setRequirements] = useState<ProfileRequirement[]>([]);
  const [roleFilter, setRoleFilter] = useState('researcher');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newRole, setNewRole] = useState('researcher');
  const [newKind, setNewKind] = useState('field');
  const [newName, setNewName] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetchSettings();
      setSettings(response);
      setEdited({});
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  const loadRequirements = useCallback(async () => {
    try {
      setRequirements(await fetchProfileRequirements(roleFilter || undefined));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [roleFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([loadSettings(), loadRequirements()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSettings, loadRequirements]);

  const settingKeys = useMemo(() => {
    const keys = new Set(Object.keys(settings));
    Object.keys(KNOWN_KEYS).forEach((key) => keys.add(key));
    Object.keys(edited).forEach((key) => keys.add(key));
    return Array.from(keys).sort();
  }, [settings, edited]);

  const saveSettings = async () => {
    if (!Object.keys(edited).length) {
      setMessage('No setting changes to save.');
      return;
    }
    setBusy('settings');
    setError(null);
    setMessage(null);
    try {
      setSettings(await updateSettings(edited));
      setEdited({});
      setMessage('Settings saved.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const toggleRequirement = async (requirement: ProfileRequirement) => {
    setBusy(`req-${requirement.id}`);
    setError(null);
    setMessage(null);
    try {
      await updateProfileRequirements([{
        role: requirement.role,
        kind: requirement.kind,
        name: requirement.name,
        required: !requirement.required,
      }]);
      await loadRequirements();
      setMessage(`${titleCase(requirement.name)} marked ${requirement.required ? 'optional' : 'required'}.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const removeRequirement = async (requirement: ProfileRequirement) => {
    setBusy(`del-${requirement.id}`);
    setError(null);
    setMessage(null);
    try {
      await deleteProfileRequirement(requirement.id);
      await loadRequirements();
      setMessage('Requirement removed.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const addRequirement = async () => {
    if (!newName.trim()) {
      setError('Enter the field or document type name.');
      return;
    }
    setBusy('add');
    setError(null);
    setMessage(null);
    try {
      await updateProfileRequirements([{
        role: newRole,
        kind: newKind,
        name: newName.trim(),
        required: true,
      }]);
      setNewName('');
      await loadRequirements();
      setMessage('Requirement added.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen topInset={false}>
      <Title subtitle="Platform-wide policy values and the fields or documents required before a profile can be reviewed.">
        Settings
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}

      <SectionTitle>Security settings</SectionTitle>
      {loading ? <Loading /> : (
        <Card>
          {settingKeys.map((key, index) => (
            <View key={key}>
              {index > 0 ? <Divider /> : null}
              <Field
                label={key}
                value={edited[key] ?? settings[key] ?? ''}
                onChangeText={(value) => setEdited((current) => ({ ...current, [key]: value }))}
                autoCapitalize="none"
                hint={KNOWN_KEYS[key]}
              />
            </View>
          ))}
          <View style={styles.actions}>
            <Button
              title="Save settings"
              onPress={saveSettings}
              loading={busy === 'settings'}
              disabled={busy === 'settings' || !Object.keys(edited).length}
            />
            <Button title="Discard" variant="ghost" onPress={() => setEdited({})} />
          </View>
          <Muted style={styles.note}>
            Changes apply to new sign-ins and profile completion calculations. Existing sessions keep
            their issued tokens until expiry.
          </Muted>
        </Card>
      )}

      <SectionTitle>Profile requirements</SectionTitle>
      <Card>
        <ChoiceRow
          label="Role"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'researcher', label: 'Researcher' },
            { value: 'business', label: 'Business' },
            { value: 'all', label: 'All' },
          ]}
        />
        {requirements.length === 0 ? (
          <EmptyState title="No requirements" message="No profile requirements are configured for this role." />
        ) : requirements.map((requirement, index) => (
          <View key={requirement.id}>
            {index > 0 ? <Divider /> : null}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={typography.h3}>{titleCase(requirement.name)}</Text>
                <Muted>{titleCase(requirement.role)} · {titleCase(requirement.kind)}</Muted>
              </View>
              <Pressable
                disabled={busy === `req-${requirement.id}`}
                onPress={() => toggleRequirement(requirement)}
              >
                <Badge
                  label={requirement.required ? 'Required' : 'Optional'}
                  tone={requirement.required ? 'success' : 'neutral'}
                />
              </Pressable>
            </View>
            <View style={styles.actions}>
              <Button
                title={requirement.required ? 'Make optional' : 'Make required'}
                variant="secondary"
                small
                loading={busy === `req-${requirement.id}`}
                onPress={() => toggleRequirement(requirement)}
              />
              <Button
                title="Delete"
                variant="danger"
                small
                loading={busy === `del-${requirement.id}`}
                onPress={() => removeRequirement(requirement)}
              />
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle>Add a requirement</SectionTitle>
      <Card>
        <ChoiceRow
          label="Role"
          value={newRole}
          onChange={setNewRole}
          options={[
            { value: 'researcher', label: 'Researcher' },
            { value: 'business', label: 'Business' },
            { value: 'auditor', label: 'Auditor' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
        <ChoiceRow
          label="Kind"
          value={newKind}
          onChange={setNewKind}
          options={[
            { value: 'field', label: 'Profile field' },
            { value: 'document', label: 'Document type' },
          ]}
        />
        <Field
          label={newKind === 'field' ? 'Field name' : 'Document type'}
          value={newName}
          onChangeText={setNewName}
          placeholder={newKind === 'field' ? 'e.g. purpose_of_research' : 'e.g. ID_PROOF'}
          autoCapitalize="none"
          required
          hint={newKind === 'field'
            ? 'Must match the profile field key used by the API.'
            : 'Must be a supported document type such as ID_PROOF, BUSINESS_LICENSE or TAX_CERTIFICATE.'}
        />
        <Button
          title="Add requirement"
          onPress={addRequirement}
          loading={busy === 'add'}
          disabled={busy === 'add'}
        />
      </Card>

      <Muted style={{ color: colors.muted }}>
        Every settings and requirement change is written to the audit trail.
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  note: { marginTop: spacing.md },
});
