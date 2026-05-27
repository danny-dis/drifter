/**
 * Platform Abstraction Layer
 *
 * Provides a unified API for platform-specific functionality.
 * Works across Electron (desktop), Capacitor (mobile), and web.
 *
 * Usage:
 *   import { platform } from '@/platform';
 *   await platform.storage.get('key');
 *   platform.ui.openFolderPicker();
 */

// ─── Types ───────────────────────────────────────────────────────────────

export type PlatformType = 'electron' | 'capacitor-android' | 'capacitor-ios' | 'web';

export interface StorageAdapter {
  get<T = string>(key: string): Promise<T | null>;
  set<T = string>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
}

export interface UIAdapter {
  openFolderPicker(): Promise<string | null>;
  openFilePicker(accept?: string): Promise<string | null>;
  showNotification(title: string, body: string): Promise<void>;
  vibrate(pattern?: number | number[]): Promise<void>;
  getStatusBarHeight(): Promise<number>;
}

export interface NetworkAdapter {
  api: {
    get(endpoint: string): Promise<unknown>;
    post(endpoint: string, body: unknown): Promise<unknown>;
    put(endpoint: string, body: unknown): Promise<unknown>;
    delete(endpoint: string): Promise<unknown>;
  };
  connectWebSocket(onMessage: (data: unknown) => void): WebSocket;
}

export interface PetAdapter {
  openCapture(): Promise<void>;
  openMain(): Promise<void>;
  savePosition(position: { edge: string; x: number; y: number }): Promise<void>;
}

export interface PlatformAPI {
  type: PlatformType;
  isElectron: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  storage: StorageAdapter;
  ui: UIAdapter;
  network: NetworkAdapter;
  pet: PetAdapter;
}

// ─── Detect Platform ─────────────────────────────────────────────────────

function detectPlatform(): PlatformType {
  // Electron
  if (typeof window !== 'undefined' && (window as any).drifterAPI) {
    return 'electron';
  }

  // Capacitor
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    const platform = (window as any).Capacitor.getPlatform?.() ?? 'unknown';
    if (platform === 'android') return 'capacitor-android';
    if (platform === 'ios') return 'capacitor-ios';
  }

  return 'web';
}

// ─── Storage Adapters ────────────────────────────────────────────────────

const electronStorage: StorageAdapter = {
  async get<T = string>(key: string): Promise<T | null> {
    const config = await (window as any).drifterAPI.config.get();
    return (config as Record<string, unknown>)[key] as T | null;
  },
  async set<T = string>(key: string, value: T): Promise<void> {
    const config = await (window as any).drifterAPI.config.get();
    (config as Record<string, unknown>)[key] = value;
    await (window as any).drifterAPI.config.save(config);
  },
  async remove(key: string): Promise<void> {
    const config = await (window as any).drifterAPI.config.get();
    delete (config as Record<string, unknown>)[key];
    await (window as any).drifterAPI.config.save(config);
  },
  async getAll(): Promise<Record<string, unknown>> {
    const config = await (window as any).drifterAPI.config.get();
    return config as Record<string, unknown>;
  },
};

const webStorage: StorageAdapter = {
  async get<T = string>(key: string): Promise<T | null> {
    const value = localStorage.getItem(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  },
  async set<T = string>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  },
  async getAll(): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        try {
          result[key] = JSON.parse(localStorage[key]);
        } catch {
          result[key] = localStorage[key];
        }
      }
    }
    return result;
  },
};

// ─── UI Adapters ─────────────────────────────────────────────────────────

const electronUI: UIAdapter = {
  async openFolderPicker() {
    return null; // Handled by backend
  },
  async openFilePicker(_accept?: string) {
    return null; // Handled by backend
  },
  async showNotification(title: string, body: string) {
    new Notification(title, { body });
  },
  async vibrate() {
    // Desktop doesn't vibrate
  },
  async getStatusBarHeight() {
    return 0;
  },
};

const webUI: UIAdapter = {
  async openFolderPicker() {
    return null;
  },
  async openFilePicker(_accept?: string) {
    return null;
  },
  async showNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  },
  async vibrate(pattern) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern ?? 50);
    }
  },
  async getStatusBarHeight() {
    return 0;
  },
};

// ─── Network Adapters ────────────────────────────────────────────────────

const BACKEND_URL = 'http://localhost:7842';

function createNetworkAdapter(): NetworkAdapter {
  return {
    api: {
      async get(endpoint: string) {
        const res = await fetch(`${BACKEND_URL}${endpoint}`);
        return res.json();
      },
      async post(endpoint: string, body: unknown) {
        const res = await fetch(`${BACKEND_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return res.json();
      },
      async put(endpoint: string, body: unknown) {
        const res = await fetch(`${BACKEND_URL}${endpoint}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return res.json();
      },
      async delete(endpoint: string) {
        const res = await fetch(`${BACKEND_URL}${endpoint}`, {
          method: 'DELETE',
        });
        return res.json();
      },
    },
    connectWebSocket(onMessage: (data: unknown) => void) {
      const ws = new WebSocket(`ws://localhost:7842/ws`);
      ws.onmessage = (event) => {
        onMessage(JSON.parse(event.data));
      };
      return ws;
    },
  };
}

// ─── Pet Adapters ────────────────────────────────────────────────────────

const electronPet: PetAdapter = {
  async openCapture() {
    await (window as any).drifterAPI.pet.openCapture();
  },
  async openMain() {
    await (window as any).drifterAPI.pet.openMain();
  },
  async savePosition(position) {
    await (window as any).drifterAPI.pet.savePosition(position);
  },
};

const noOpPet: PetAdapter = {
  async openCapture() {},
  async openMain() {},
  async savePosition(_position) {},
};

// ─── Export Platform ─────────────────────────────────────────────────────

const platformType = detectPlatform();

export const platform: PlatformAPI = {
  type: platformType,
  isElectron: platformType === 'electron',
  isMobile: platformType.startsWith('capacitor'),
  isDesktop: platformType === 'electron',
  isAndroid: platformType === 'capacitor-android',
  isIOS: platformType === 'capacitor-ios',

  storage: platformType === 'electron' ? electronStorage : webStorage,
  ui: platformType === 'electron' ? electronUI : webUI,
  network: createNetworkAdapter(),
  pet: platformType === 'electron' ? electronPet : noOpPet,
};
