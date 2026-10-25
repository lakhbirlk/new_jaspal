import React, { useCallback, useEffect, useState } from 'react';
import { fetchMyDocuments } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { DocumentSummary } from '../../api/types';
import { DocumentList, DocumentUploader } from '../../components/DocumentsPanel';
import { Banner, Loading, Screen, Title } from '../../components/ui';

export default function MyDocumentsScreen({ topInset = true }: { topInset?: boolean }) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDocuments(await fetchMyDocuments());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen topInset={topInset}>
      <Title subtitle="Upload the documents required for your role. Reviewers can approve or reject each file.">
        Documents
      </Title>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      <DocumentUploader onUploaded={() => { void load(); }} />
      {loading ? <Loading /> : <DocumentList documents={documents} downloadable={false} />}
    </Screen>
  );
}
