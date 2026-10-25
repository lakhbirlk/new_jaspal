import React, { useCallback, useEffect, useState } from 'react';
import { fetchDocumentQueue, approveDocument, rejectDocument } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { DocumentSummary } from '../../api/types';
import { DocumentList } from '../../components/DocumentsPanel';
import {
  Banner,
  Card,
  ChoiceRow,
  EmptyState,
  Loading,
  Pager,
  Screen,
  Title,
} from '../../components/ui';

export default function AdminDocumentsScreen() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<DocumentSummary[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchDocumentQueue({
        status: status || undefined,
        page,
        size: 20,
      });
      setItems(response.items);
      setTotalPages(response.totalPages);
      setTotal(response.total);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen topInset={false}>
      <Title subtitle="Approve or reject uploaded identity and business documents. Rejections require a reason visible to the owner.">
        Document review
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      <Card>
        <ChoiceRow
          label="Status"
          value={status}
          onChange={(value) => { setStatus(value); setPage(0); }}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: '', label: 'All' },
          ]}
        />
      </Card>
      {loading ? <Loading /> : items.length ? (
        <>
          <DocumentList
            documents={items}
            review={{
              onApprove: async (id) => {
                await approveDocument(id);
                await load();
              },
              onReject: async (id, reason) => {
                await rejectDocument(id, reason);
                await load();
              },
            }}
          />
          <Pager page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </>
      ) : (
        <EmptyState title="Nothing in this queue" message="No documents match the selected status." />
      )}
    </Screen>
  );
}
