import {
  IPlatformServices,
  PlatformInfo,
  IFileSystem,
  IFilePicker,
  ISecureStorage,
  INotifications,
  IClipboard,
  IShare,
  INetwork,
  FileMetadata,
  FileFilter,
} from '../PlatformInterface';

class WebSecureStorage implements ISecureStorage {
  private prefix = 'librix_sec_';

  // Derives AES-GCM encryption key from device salt stored in localStorage
  private async getEncryptionKey(): Promise<CryptoKey> {
    const saltKey = 'librix_dev_salt';
    let salt = localStorage.getItem(saltKey);
    if (!salt) {
      const randomBytes = crypto.getRandomValues(new Uint8Array(16));
      salt = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(saltKey, salt);
    }
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(salt + 'librix_master_key_seed'),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: enc.encode(salt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async getSecret(key: string): Promise<string | null> {
    try {
      const stored = localStorage.getItem(this.prefix + key);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      const iv = new Uint8Array(parsed.iv);
      const data = new Uint8Array(parsed.data);
      const cryptoKey = await this.getEncryptionKey();
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
      );
      return new TextDecoder().decode(decrypted);
    } catch {
      return null;
    }
  }

  async setSecret(key: string, value: string): Promise<void> {
    const cryptoKey = await this.getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      enc.encode(value)
    );
    const payload = {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted)),
    };
    localStorage.setItem(this.prefix + key, JSON.stringify(payload));
  }

  async deleteSecret(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }
}

class WebFileSystem implements IFileSystem {
  private memStorage = new Map<string, Uint8Array>();

  async readFile(path: string): Promise<Uint8Array> {
    if (this.memStorage.has(path)) {
      return this.memStorage.get(path)!;
    }
    // Check localStorage fallback for text
    const local = localStorage.getItem('librix_fs_' + path);
    if (local) {
      return new TextEncoder().encode(local);
    }
    throw new Error(`File not found: ${path}`);
  }

  async readTextFile(path: string): Promise<string> {
    const bytes = await this.readFile(path);
    return new TextDecoder().decode(bytes);
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.memStorage.set(path, bytes);
    if (bytes.length < 500000) {
      // Store small files in local storage as well for session persistence
      if (typeof data === 'string') {
        localStorage.setItem('librix_fs_' + path, data);
      }
    }
  }

  async deleteFile(path: string): Promise<void> {
    this.memStorage.delete(path);
    localStorage.removeItem('librix_fs_' + path);
  }

  async listDirectory(path: string): Promise<FileMetadata[]> {
    const results: FileMetadata[] = [];
    for (const [filePath, data] of this.memStorage.entries()) {
      if (filePath.startsWith(path)) {
        results.push({
          name: filePath.split('/').pop() || filePath,
          path: filePath,
          size: data.length,
          lastModified: Date.now(),
          isDirectory: false,
        });
      }
    }
    return results;
  }

  async createDirectory(_path: string): Promise<void> {
    // Virtual directories in Web memory FS
  }

  async exists(path: string): Promise<boolean> {
    return this.memStorage.has(path) || localStorage.getItem('librix_fs_' + path) !== null;
  }

  async getMetadata(path: string): Promise<FileMetadata> {
    const bytes = await this.readFile(path);
    return {
      name: path.split('/').pop() || path,
      path,
      size: bytes.length,
      lastModified: Date.now(),
      isDirectory: false,
    };
  }

  async getAppStorageDir(): Promise<string> {
    return '/librix_vault';
  }
}

class WebFilePicker implements IFilePicker {
  async pickDocument(filters?: FileFilter[], multiple = false): Promise<Array<{ name: string; path: string; data?: Uint8Array }>> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = multiple;
      if (filters && filters.length > 0) {
        input.accept = filters.flatMap(f => f.extensions.map(ext => `.${ext}`)).join(',');
      }
      input.onchange = async () => {
        if (!input.files || input.files.length === 0) {
          resolve([]);
          return;
        }
        const results = [];
        for (let i = 0; i < input.files.length; i++) {
          const file = input.files[i];
          const buffer = await file.arrayBuffer();
          results.push({
            name: file.name,
            path: `local://${file.name}`,
            data: new Uint8Array(buffer),
          });
        }
        resolve(results);
      };
      input.click();
    });
  }

  async pickFolder(): Promise<{ path: string; name: string } | null> {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker();
        return {
          name: handle.name,
          path: `opfs://${handle.name}`,
        };
      } catch {
        return null;
      }
    }
    return {
      name: 'Librix Library',
      path: '/librix_library',
    };
  }

  async saveDocument(suggestedName: string, data: Uint8Array, mimeType = 'application/octet-stream'): Promise<string | null> {
    const blob = new Blob([data as unknown as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return suggestedName;
  }
}

export class WebPlatform implements IPlatformServices {
  readonly platform: PlatformInfo = {
    os: 'web',
    deviceType: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : typeof window !== 'undefined' && window.innerWidth < 1024 ? 'tablet' : 'desktop',
    isMobile: typeof window !== 'undefined' ? (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) : false,
    isDesktop: typeof window !== 'undefined' ? (window.innerWidth >= 1024 && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) : true,
    isTouch: typeof window !== 'undefined' ? ('ontouchstart' in window || navigator.maxTouchPoints > 0) : false,
    isNative: false,
    version: '1.0.0-web',
  };

  readonly fileSystem = new WebFileSystem();
  readonly filePicker = new WebFilePicker();
  readonly secureStorage = new WebSecureStorage();

  readonly notifications: INotifications = {
    async show(title: string, options?: { body?: string; icon?: string }) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, options);
      }
    },
    async requestPermission() {
      if ('Notification' in window) {
        const res = await Notification.requestPermission();
        return res === 'granted';
      }
      return false;
    },
  };

  readonly clipboard: IClipboard = {
    async copyText(text: string) {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    },
    async readText() {
      if (navigator.clipboard) {
        return await navigator.clipboard.readText();
      }
      return '';
    },
  };

  readonly share: IShare = {
    canShare() {
      return typeof navigator.share === 'function';
    },
    async shareText(title: string, text: string, url?: string) {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      }
    },
    async shareFile(name: string, data: Uint8Array, mimeType: string) {
      if (navigator.share && navigator.canShare) {
        const file = new File([data as unknown as BlobPart], name, { type: mimeType });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: name });
        }
      }
    },
  };

  readonly network: INetwork = {
    isOnline() {
      return navigator.onLine;
    },
    onNetworkChange(callback: (online: boolean) => void) {
      const handleOnline = () => callback(true);
      const handleOffline = () => callback(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    },
  };
}
