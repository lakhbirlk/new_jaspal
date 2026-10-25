import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchAdminBusinesses } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { BusinessRecord, PageResult } from '../../api/types';
import { BusinessCard } from '../../components/business';
import {
  Banner,
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
import type { AdminStackParamList } from '../../navigation/types';

export default function AdminBusinessesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [listingStatus, setListingStatus] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<PageResult<BusinessRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      setResult(await fetchAdminBusinesses({
        q: query || undefined,
        verificationStatus: verificationStatus || undefined,
        listingStatus: listingStatus || undefined,
        page,
        size: 20,
      }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [query, verificationStatus, listingStatus, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(useCallback(() => {
    void load(false);
  }, [load]));

  return (
    <Screen>
      <Title subtitle="Verify profiles, govern listings, and inspect every field across roles.">
        Businesses
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      <Card>
        <Field
          label="Search"
          value={draft}
          onChangeText={setDraft}
          placeholder="Legal name, trade name, city, or industry"
          onSubmitEditing={() => { setPage(0); setQuery(draft.trim()); }}
          returnKeyType="search"
        />
        <ChoiceRow
          label="Verification"
          value={verificationStatus}
          onChange={(value) => { setVerificationStatus(value); setPage(0); }}
          options={[
            { value: '', label: 'All' },
            { value: 'unverified', label: 'Unverified' },
            { value: 'verified', label: 'Verified' },
          ]}
        />
        <ChoiceRow
          label="Listing"
          value={listingStatus}
          onChange={(value) => { setListingStatus(value); setPage(0); }}
          options={[
            { value: '', label: 'All' },
            { value: 'listed', label: 'Listed' },
            { value: 'awaiting_plan', label: 'Awaiting plan' },
            { value: 'expired', label: 'Expired' },
            { value: 'unlisted_by_admin', label: 'Unlisted by admin' },
            { value: 'not_approved', label: 'Not approved' },
          ]}
        />
      </Card>

      {loading ? <Loading /> : result && result.items.length ? (
        <>
          {result.items.map((business) => (
            <BusinessCard
              key={business.id}
              record={business}
              onPress={() => navigation.navigate('AdminBusinessDetail', {
                id: business.id,
                title: String(business.legal_name ?? 'Business'),
              })}
            />
          ))}
          {result.items.some((business) => business.owner) ? (
            <Muted>Tap a business to see owner and document details.</Muted>
          ) : null}
          <Pager page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} />
        </>
      ) : (
        <EmptyState title="No businesses found" message="Adjust the filters and try again." />
      )}
    </Screen>
  );
}
