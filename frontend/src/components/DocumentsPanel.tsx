import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { uploadDocument } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { DocumentSummary } from '../api/types';
import { documentTypeLabel, formatBytes, formatDateTime, statusTone, titleCase } from '../lib/format';
import { openDocumentFile } from '../lib/documents';
import { colors, spacing, typography } from '../theme';
import { Badge, Banner, Button, Card, ChoiceRow, EmptyState, Field, Muted, SectionTitle } from './ui';

export function DocumentList({
  documents,
  review,
  downloadable = true,
}: {
  documents: DocumentSummary[];
  review?: {
    onApprove: (id: string) => Promise<void>;
    onReject: (id: string, reason: string) => Promise<void>;
  };
  downloadable?: boolean;
}) {
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!documents.length) {
    return <EmptyState title="No documents" message="Uploaded documents will appear here." />;
  }

  const act = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      setRejecting(null);
      setReason('');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {documents.map((document) => (
        <Card key={document.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={typography.h3}>{documentTypeLabel(document.docType)}</Text>
              <Text style={[typography.small, { marginTop: 2 }]}>
                {document.originalFilename} · {formatBytes(document.sizeBytes)}
              </Text>
              <Muted style={{ marginTop: 2 }}>Uploaded {formatDateTime(document.createdAt)}</Muted>
            </View>
            <Badge label={titleCase(document.status)} tone={statusTone(document.status)} />
          </View>
          {document.rejectionReason ? (
            <Muted style={{ marginTop: spacing.sm, color: colors.danger }}>
              Rejected: {document.rejectionReason}
            </Muted>
          ) : null}
          {document.reviewedAt ? (
            <Muted style={{ marginTop: spacing.xs }}>Reviewed {formatDateTime(document.reviewedAt)}</Muted>
          ) : null}

          <View style={styles.actions}>
            {downloadable ? (
              <Button
                title="Open file"
                variant="secondary"
                small
                onPress={() => act(document.id, async () => {
                  const result = await openDocumentFile(document.id);
                  if (!result.opened) throw new Error(result.reason ?? 'Cannot open this file.');
                })}
              />
            ) : null}
            {review && document.status === 'pending' ? (
              <>
                <Button
                  title="Approve"
                  variant="success"
                  small
                  loading={busyId === document.id}
                  onPress={() => act(document.id, () => review.onApprove(document.id))}
                />
                <Button
                  title="Reject"
                  variant="danger"
                  small
                  onPress={() => {
                    setRejecting(rejecting === document.id ? null : document.id);
                    setReason('');
                  }}
                />
              </>
            ) : null}
          </View>

          {review && rejecting === document.id ? (
            <View style={{ marginTop: spacing.md }}>
              <Field
                label="Rejection reason"
                value={reason}
                onChangeText={setReason}
                placeholder="Explain what the owner needs to fix"
                multiline
              />
              <Button
                title="Confirm rejection"
                variant="danger"
                small
                loading={busyId === document.id}
                disabled={!reason.trim()}
                onPress={() => act(document.id, () => review.onReject(document.id, reason.trim()))}
              />
            </View>
          ) : null}
        </Card>
      ))}
    </View>
  );
}

export function DocumentUploader({ onUploaded }: { onUploaded: () => void }) {
  const [docType, setDocType] = useState('ID_PROOF');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const choose = async () => {
    setError(null);
    setSuccess(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setBusy(true);
      const file = (asset as unknown as { file?: File }).file;
      await uploadDocument(
        { uri: asset.uri, name: asset.name, mimeType: asset.mimeType, file },
        docType,
      );
      setFileName(asset.name);
      setSuccess(`${asset.name} uploaded for review.`);
      onUploaded();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle>Upload a document</SectionTitle>
      <ChoiceRow
        label="Document type"
        value={docType}
        onChange={setDocType}
        options={[
          { value: 'ID_PROOF', label: 'ID proof' },
          { value: 'BUSINESS_LICENSE', label: 'Business licence' },
          { value: 'TAX_CERTIFICATE', label: 'Tax certificate' },
          { value: 'ADDRESS_PROOF', label: 'Address proof' },
          { value: 'OTHER', label: 'Other' },
        ]}
      />
      <Muted style={{ marginBottom: spacing.md }}>
        PDF or image, up to 10 MB. Files are stored encrypted and reviewed by an administrator.
      </Muted>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}
      {success ? <Banner tone="success" message={success} /> : null}
      <Button
        title={busy ? 'Uploading…' : 'Choose file and upload'}
        onPress={choose}
        loading={busy}
        disabled={busy}
      />
      {fileName ? <Muted style={{ marginTop: spacing.xs }}>Last selected: {fileName}</Muted> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
});
