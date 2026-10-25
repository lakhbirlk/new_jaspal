import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Card, Muted, Screen, SectionTitle, Title } from '../../components/ui';
import type { AdminStackParamList } from '../../navigation/types';
import { spacing, typography } from '../../theme';

type Destination = Exclude<keyof AdminStackParamList, 'AdminTabs' | 'UserDetail' | 'PolicyOverrides' | 'AdminBusinessDetail'>;

interface LinkItem {
  title: string;
  description: string;
  destination: Destination;
  badge?: string;
}

const GROUPS: { heading: string; items: LinkItem[] }[] = [
  {
    heading: 'Review queues',
    items: [
      {
        title: 'Document review',
        description: 'Approve or reject uploaded identity and business documents.',
        destination: 'Documents',
      },
    ],
  },
  {
    heading: 'Billing',
    items: [
      {
        title: 'Plans',
        description: 'Create researcher credit plans and business listing plans.',
        destination: 'Plans',
      },
      {
        title: 'Subscriptions',
        description: 'Adjust credits, extend or cancel researcher subscriptions.',
        destination: 'Subscriptions',
      },
      {
        title: 'Listings',
        description: 'Allow, unlist, extend or cancel business listings.',
        destination: 'Listings',
      },
      {
        title: 'Payments',
        description: 'Confirm offline payments and issue refunds.',
        destination: 'Payments',
      },
    ],
  },
  {
    heading: 'Access & governance',
    items: [
      {
        title: 'Visibility policies',
        description: 'Field-level access matrix by role and unlock state.',
        destination: 'Policies',
      },
      {
        title: 'Audit trail',
        description: 'Search security events and export a CSV extract.',
        destination: 'AuditLogs',
      },
      {
        title: 'Settings',
        description: 'Security thresholds and profile completion requirements.',
        destination: 'Settings',
      },
      {
        title: 'My account',
        description: 'Profile, MFA enrolment and session details.',
        destination: 'Account',
      },
    ],
  },
];

export default function AdminMoreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();

  return (
    <Screen>
      <Title subtitle="Administrative tools, governance and billing controls.">Control panel</Title>
      {GROUPS.map((group) => (
        <View key={group.heading}>
          <SectionTitle>{group.heading}</SectionTitle>
          <Card>
            {group.items.map((item, index) => (
              <View key={item.destination}>
                {index > 0 ? <View style={styles.separator} /> : null}
                <Card
                  onPress={() => navigation.navigate(item.destination as never)}
                  style={styles.linkCard}
                >
                  <View style={styles.linkRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.h3}>{item.title}</Text>
                      <Muted>{item.description}</Muted>
                    </View>
                    {item.badge ? <Badge label={item.badge} tone="info" /> : null}
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </Card>
              </View>
            ))}
          </Card>
        </View>
      ))}
      <Muted>
        Sensitive administrative actions are restricted by role permissions and recorded in the audit
        trail.
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  linkCard: { marginBottom: 0, borderWidth: 0, paddingHorizontal: 0, paddingVertical: spacing.sm, shadowOpacity: 0, elevation: 0 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chevron: { fontSize: 24, color: '#94a3b8', marginLeft: spacing.xs },
  separator: { height: 1, backgroundColor: '#e2e8f0' },
});
