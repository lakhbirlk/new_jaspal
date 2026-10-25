import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Access, BusinessRecord } from '../api/types';
import {
  BUSINESS_DISPLAY_ORDER,
  BUSINESS_FIELDS,
  displayValue,
  humanizeField,
  statusTone,
  titleCase,
} from '../lib/format';
import { spacing, typography } from '../theme';
import { Badge, Card, Divider, Field, KeyValue, Muted, SectionTitle } from './ui';

export type BusinessFormValues = Record<string, string>;

export function businessToForm(record: BusinessRecord): BusinessFormValues {
  const values: BusinessFormValues = {};
  BUSINESS_FIELDS.forEach((field) => {
    const raw = record[field.key];
    values[field.key] = raw === null || raw === undefined ? '' : String(raw);
  });
  return values;
}

export function BusinessForm({
  values,
  onChange,
  accessFor,
  missing,
}: {
  values: BusinessFormValues;
  onChange: (key: string, value: string) => void;
  accessFor?: (field: string) => Access;
  missing?: string[];
}) {
  return (
    <View>
      {BUSINESS_FIELDS.map((field) => {
        const access = accessFor?.(field.key);
        if (access === 'hidden') return null;
        const editable = !access || access === 'write';
        const isMissing = missing?.includes(field.key);
        return (
          <Field
            key={field.key}
            label={field.label}
            value={values[field.key] ?? ''}
            onChangeText={(value) => onChange(field.key, value)}
            keyboardType={field.keyboard}
            multiline={field.multiline}
            autoCapitalize={field.keyboard === 'email-address' || field.keyboard === 'url' ? 'none' : 'sentences'}
            placeholder={field.placeholder}
            editable={editable}
            required={field.required}
            hint={isMissing ? 'Required before submitting for review' : undefined}
            error={isMissing ? 'Missing required value' : undefined}
          />
        );
      })}
    </View>
  );
}

export function BusinessDetails({
  record,
  accessFor,
  compact,
}: {
  record: BusinessRecord;
  accessFor?: (field: string) => Access;
  compact?: boolean;
}) {
  const present = BUSINESS_DISPLAY_ORDER.filter((key) => record[key] !== undefined && record[key] !== null);
  if (present.length === 0) {
    return <Muted>No fields are visible with your current access.</Muted>;
  }

  const groups: { title: string; keys: string[] }[] = [
    {
      title: 'Company',
      keys: ['legal_name', 'trade_name', 'registration_number', 'tax_id', 'industry', 'category', 'website', 'description'],
    },
    {
      title: 'Location and contact',
      keys: [
        'address_line', 'city', 'state', 'country', 'postal_code', 'public_email', 'public_phone',
        'contact_person_name', 'contact_person_phone',
      ],
    },
    {
      title: 'Financial',
      keys: ['annual_revenue', 'employee_count', 'bank_details'],
    },
    {
      title: 'Status',
      keys: ['verification_status', 'admin_listing_status', 'listing_status', 'listed_until', 'created_at', 'updated_at'],
    },
  ];

  return (
    <View>
      <View style={styles.badgeRow}>
        {record.listing_status ? (
          <Badge label={titleCase(String(record.listing_status))} tone={statusTone(String(record.listing_status))} />
        ) : null}
        {record.verification_status ? (
          <Badge
            label={titleCase(String(record.verification_status))}
            tone={statusTone(String(record.verification_status))}
          />
        ) : null}
      </View>
      {groups.map((group) => {
        const keys = group.keys.filter((key) => present.includes(key));
        if (keys.length === 0) return null;
        return (
          <Card key={group.title} style={compact ? styles.compactCard : undefined}>
            <Text style={typography.h3}>{group.title}</Text>
            <Divider />
            {keys.map((key) => {
              const access = accessFor?.(key);
              const raw = record[key];
              const value = key === 'description' && raw
                ? String(raw)
                : displayValue(key, raw);
              if (key === 'verification_status' || key === 'admin_listing_status' || key === 'listing_status') {
                return (
                  <KeyValue
                    key={key}
                    label={humanizeField(key)}
                    value={<Badge label={titleCase(String(raw))} tone={statusTone(String(raw))} />}
                  />
                );
              }
              return (
                <KeyValue
                  key={key}
                  label={humanizeField(key)}
                  value={value}
                  access={access}
                  mono={key === 'tax_id' || key === 'registration_number' || key === 'bank_details'}
                />
              );
            })}
          </Card>
        );
      })}
    </View>
  );
}

export function BusinessCard({
  record,
  onPress,
  locked,
}: {
  record: BusinessRecord;
  onPress?: () => void;
  locked?: boolean;
}) {
  return (
    <Card onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={typography.h3}>{String(record.legal_name ?? 'Business')}</Text>
          <Text style={[typography.small, { marginTop: 2 }]}>
            {[record.industry, record.city, record.country].filter(Boolean).join(' · ') || 'No location listed'}
          </Text>
        </View>
        {locked ? <Badge label="Locked" tone="warning" /> : (
          <Badge label="Unlocked" tone="success" />
        )}
      </View>
      {record.description ? (
        <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]} numberOfLines={3}>
          {String(record.description)}
        </Text>
      ) : null}
      <View style={[styles.badgeRow, { marginTop: spacing.md }]}>
        {record.listing_status ? (
          <Badge label={titleCase(String(record.listing_status))} tone={statusTone(String(record.listing_status))} />
        ) : null}
        {record.public_phone ? <Muted>{String(record.public_phone)}</Muted> : null}
      </View>
    </Card>
  );
}

export function MissingFields({ missing }: { missing: string[] }) {
  if (!missing.length) return null;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <SectionTitle>Needed before review</SectionTitle>
      <View style={styles.missingWrap}>
        {missing.map((field) => (
          <Badge key={field} label={humanizeField(field)} tone="warning" />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  compactCard: { paddingVertical: spacing.sm },
  missingWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
});
