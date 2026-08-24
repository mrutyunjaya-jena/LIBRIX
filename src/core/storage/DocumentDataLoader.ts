/**
 * LIBRIX Universal Document Data Loader
 * Streams raw binary book/document content seamlessly across Local, Google Drive,
 * OneDrive, MEGA, Telegram Vault, and Custom WebDAV/S3 storage providers.
 */

import { Document } from '../types';
import { fileBinaryStore } from './FileBinaryStore';
import { storageRegistry } from '../../storage/StorageRegistry';

export class DocumentDataLoader {
  /**
   * Loads the raw binary content of any document, resolving transparently from
   * local IndexedDB cache or streaming on-the-fly from the document's connected cloud provider.
   */
  public static async loadDocumentBytes(document: Document): Promise<Uint8Array | null> {
    // 1. Try local IndexedDB binary store first
    try {
      const localBytes = await fileBinaryStore.getFileBytes(document.id);
      if (localBytes && localBytes.length > 0) {
        return localBytes;
      }
    } catch {
      // fallback to remote
    }

    // 2. If not present locally, stream directly from connected cloud provider
    if (document.storageProvider && document.storageProvider !== 'local') {
      try {
        const provider =
          storageRegistry.getProvider(document.storageProvider) ||
          storageRegistry.getAllProviders().find(p => p.type === document.storageProvider);

        if (provider) {
          await provider.authenticate();
          const remoteBytes = await provider.download(document.storagePath || document.id);
          if (remoteBytes && remoteBytes.length > 0) {
            // Cache locally for offline availability
            await fileBinaryStore.saveFileBlob(
              document.id,
              remoteBytes,
              document.mimeType || 'application/octet-stream',
              document.filename || document.title
            );
            return remoteBytes;
          }
        }
      } catch (err) {
        console.warn(`Could not stream document from cloud provider (${document.storageProvider}):`, err);
      }
    }

    return null;
  }
}
