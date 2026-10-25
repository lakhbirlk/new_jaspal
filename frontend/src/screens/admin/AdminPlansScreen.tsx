import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createPlan, fetchAdminPlans, updatePlan } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { Plan } from '../../api/types';
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
  Screen,
  Title,
} from '../../components/ui';
import { formatMoney, titleCase } from '../../lib/format';
import { spacing, typography } from '../../theme';

interface FormState {
  code: string;
  name: string;
  audience: 'researcher' | 'business';
  credits: string;
  durationMonths: string;
  priceAmount: string;
  currency: string;
  active: string;
}

const blankForm: FormState = {
  code: '',
  name: '',
  audience: 'researcher',
  credits: '5',
  durationMonths: '1',
  priceAmount: '0',
  currency: 'INR',
  active: 'true',
};

export default function AdminPlansScreen() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPlans(await fetchAdminPlans());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setFormOpen(true);
    setMessage(null);
  };

  const startEdit = (plan: Plan) => {
    setEditing(plan.id);
    setForm({
      code: plan.code,
      name: plan.name,
      audience: plan.audience,
      credits: String(plan.credits ?? 0),
      durationMonths: String(plan.durationMonths),
      priceAmount: String(plan.priceAmount ?? 0),
      currency: plan.currency || 'INR',
      active: plan.active ? 'true' : 'false',
    });
    setFormOpen(true);
    setMessage(null);
  };

  const change = (key: keyof FormState) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      audience: form.audience,
      credits: Number(form.credits) || 0,
      durationMonths: Number(form.durationMonths) || 1,
      priceAmount: Number(form.priceAmount) || 0,
      currency: form.currency.trim().toUpperCase() || 'INR',
      active: form.active === 'true',
    };
    try {
      if (editing) {
        await updatePlan(editing, payload);
        setMessage('Plan updated.');
      } else {
        await createPlan(payload);
        setMessage('Plan created.');
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen topInset={false}>
      <Title subtitle="Researcher plans grant credits. Business plans control listing duration.">
        Plans
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {message ? <Banner tone="success" message={message} onDismiss={() => setMessage(null)} /> : null}
      <Button title="Create a plan" onPress={startCreate} style={{ marginBottom: spacing.md }} />

      {formOpen ? (
        <Card>
          <Text style={typography.h3}>{editing ? 'Edit plan' : 'New plan'}</Text>
          <View style={{ height: spacing.md }} />
          <Field label="Code" value={form.code} onChangeText={change('code')} autoCapitalize="characters" required />
          <Field label="Name" value={form.name} onChangeText={change('name')} required />
          <ChoiceRow
            label="Audience"
            value={form.audience}
            onChange={(value) => change('audience')(value)}
            options={[
              { value: 'researcher', label: 'Researcher' },
              { value: 'business', label: 'Business' },
            ]}
          />
          <Field label="Credits" value={form.credits} onChangeText={change('credits')} keyboardType="numeric" hint="Researcher plans require at least 1" />
          <Field label="Duration (months)" value={form.durationMonths} onChangeText={change('durationMonths')} keyboardType="numeric" required />
          <Field label="Price" value={form.priceAmount} onChangeText={change('priceAmount')} keyboardType="numeric" />
          <Field label="Currency" value={form.currency} onChangeText={change('currency')} autoCapitalize="characters" />
          <ChoiceRow
            label="Active"
            value={form.active}
            onChange={change('active')}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
          />
          <View style={styles.actions}>
            <Button title={editing ? 'Save changes' : 'Create plan'} onPress={save} loading={saving} disabled={saving} />
            <Button title="Cancel" variant="ghost" onPress={() => { setFormOpen(false); setEditing(null); }} />
          </View>
        </Card>
      ) : null}

      {loading ? <Loading /> : plans.length === 0 ? (
        <EmptyState title="No plans" message="Create a researcher or business plan to get started." />
      ) : plans.map((plan) => (
        <Card key={plan.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={typography.h3}>{plan.name}</Text>
              <Muted>{plan.code} · {titleCase(plan.audience)} · {plan.durationMonths} months</Muted>
            </View>
            <Badge label={plan.active ? 'Active' : 'Inactive'} tone={plan.active ? 'success' : 'neutral'} />
          </View>
          <View style={styles.row}>
            <Muted>
              {plan.audience === 'researcher' ? `${plan.credits ?? 0} credits · ` : null}
              {formatMoney(plan.priceAmount, plan.currency)}
            </Muted>
            <Button title="Edit" variant="secondary" small onPress={() => startEdit(plan)} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
