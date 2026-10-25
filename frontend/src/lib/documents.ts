import { Platform } from 'react-native';
import { downloadDocument } from '../api/endpoints';

export async function openDocumentFile(id: string): Promise<{ opened: boolean; reason?: string }> {
  const blob = await downloadDocument(id);
  if (Platform.OS !== 'web') {
    return { opened: false, reason: 'Document downloads are available in the web build.' };
  }
  const globalWindow = globalThis as unknown as {
    URL?: { createObjectURL: (blob: Blob) => string; revokeObjectURL: (url: string) => void };
    open?: (url: string, target?: string) => unknown;
  };
  if (!globalWindow.URL || !globalWindow.open) {
    return { opened: false, reason: 'This environment cannot open the file.' };
  }
  const url = globalWindow.URL.createObjectURL(blob);
  globalWindow.open(url, '_blank');
  setTimeout(() => globalWindow.URL?.revokeObjectURL(url), 60_000);
  return { opened: true };
}
