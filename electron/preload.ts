/**
 * Electron Preload Script
 *
 * Exposes a secure API to renderer processes via contextBridge.
 * This is the only bridge between the main process and renderer.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Types for the exposed API
export interface DrifterAPI {
  // Pet window controls
  pet: {
    openCapture: () => Promise<void>;
    openMain: () => Promise<void>;
    savePosition: (position: { edge: string; x: number; y: number }) => Promise<void>;
  };

  // Config management
  config: {
    get: () => Promise<import('./config').DrifterConfig>;
    save: (config: import('./config').DrifterConfig) => Promise<void>;
  };

  // Backend API proxy
  api: {
    get: (endpoint: string) => Promise<unknown>;
    post: (endpoint: string, body: unknown) => Promise<unknown>;
  };

  // Platform detection
  platform: {
    isElectron: boolean;
    isMobile: boolean;
    isDesktop: boolean;
  };
}

contextBridge.exposeInMainWorld('drifterAPI', {
  pet: {
    openCapture: () => ipcRenderer.invoke('pet:open-capture'),
    openMain: () => ipcRenderer.invoke('pet:open-main'),
    savePosition: (position: { edge: string; x: number; y: number }) =>
      ipcRenderer.invoke('pet:save-position', position),
  },

  config: {
    get: () => ipcRenderer.invoke('config:get'),
    save: (config: import('./config').DrifterConfig) =>
      ipcRenderer.invoke('config:save', config),
  },

  api: {
    get: (endpoint: string) => ipcRenderer.invoke('api:get', endpoint),
    post: (endpoint: string, body: unknown) =>
      ipcRenderer.invoke('api:post', endpoint, body),
  },

  platform: {
    isElectron: true,
    isMobile: false,
    isDesktop: true,
  },
});
