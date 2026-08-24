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
        await storageRegistry.initializeFromDatabase();

        const provider =
          storageRegistry.getProvider(document.storageProvider) ||
          storageRegistry.getAllProviders().find(p => p.type === document.storageProvider && p.isConnected()) ||
          storageRegistry.getAllProviders().find(p => p.type === document.storageProvider) ||
          (document.storageProvider === 'gdrive' ? storageRegistry.getProvider('gdrive-main') : undefined);

        if (provider) {
          if (!provider.isConnected()) {
            await provider.authenticate().catch(() => {});
          }
          const targetIdOrPath = document.cloudFileId || document.storagePath || document.filename || document.id;
          const hintFilename = document.filename || document.title;
          const remoteBytes = typeof (provider as any).download === 'function'
            ? await (provider as any).download(targetIdOrPath, hintFilename)
            : await provider.download(targetIdOrPath);

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
