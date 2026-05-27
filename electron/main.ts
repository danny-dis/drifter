/**
 * Electron Main Process
 *
 * Responsibilities:
 * - Spawn Python backend as child process
 * - Wait for FastAPI health check
 * - Create main app window (2D Office)
 * - Create floating pet window
 * - Handle IPC between windows
 * - Persist pet position across restarts
 */

import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { createPetWindow, PetWindowManager } from './pet-window';
import { loadConfig, saveConfig, DrifterConfig } from './config';

// Global references to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
let petManager: PetWindowManager | null = null;
let backendProcess: ChildProcess | null = null;

const BACKEND_PORT = 7842;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

/**
 * Spawn the Python FastAPI backend as a child process.
 * Returns a promise that resolves when the backend is healthy.
 */
async function spawnBackend(): Promise<void> {
  const backendPath = path.join(__dirname, '..', 'backend');
  const isDev = !app.isPackaged;

  // In development, use `uv run python -m src.main`
  // In production, use the bundled Python runtime
  const cmd = isDev ? 'uv' : 'python';
  const args = isDev
    ? ['run', 'python', '-m', 'src.main', '--port', String(BACKEND_PORT)]
    : ['-m', 'src.main', '--port', String(BACKEND_PORT)];

  backendProcess = spawn(cmd, args, {
    cwd: backendPath,
    env: { ...process.env, DRIFTER_PORT: String(BACKEND_PORT) },
    stdio: isDev ? 'inherit' : 'pipe',
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend exited with code ${code}`);
    backendProcess = null;
  });

  // Poll health endpoint until ready
  await waitForBackend();
}

/**
 * Poll the backend health endpoint until it responds.
 * Timeout after 30 seconds.
 */
async function waitForBackend(): Promise<void> {
  const maxAttempts = 60;
  const intervalMs = 500;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        console.log('Backend is ready');
        return;
      }
    } catch {
      // Backend not ready yet
    }
    await sleep(intervalMs);
  }

  throw new Error('Backend failed to start within 30 seconds');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create the main 2D Office window.
 */
function createMainWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1280, width),
    height: Math.min(900, height),
    minWidth: 800,
    minHeight: 600,
    frame: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the frontend
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Handle IPC from renderer processes.
 */
function setupIpc(): void {
  // Pet window requests
  ipcMain.handle('pet:open-capture', (_event) => {
    petManager?.openQuickCapture();
  });

  ipcMain.handle('pet:open-main', (_event) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Pet position persistence
  ipcMain.handle('pet:save-position', (_event, position: { edge: string; x: number; y: number }) => {
    const config = loadConfig();
    config.pet = position;
    saveConfig(config);
  });

  // Companion config
  ipcMain.handle('config:get', (_event): DrifterConfig => {
    return loadConfig();
  });

  ipcMain.handle('config:save', (_event, config: DrifterConfig) => {
    saveConfig(config);
  });

  // Backend API proxy (for when CORS is an issue)
  ipcMain.handle('api:post', async (_event, endpoint: string, body: unknown) => {
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  });

  ipcMain.handle('api:get', async (_event, endpoint: string) => {
    const response = await fetch(`${BACKEND_URL}${endpoint}`);
    return response.json();
  });
}

/**
 * App lifecycle.
 */
app.whenReady().then(async () => {
  // Start backend first
  try {
    await spawnBackend();
  } catch (err) {
    console.error('Backend startup failed:', err);
    // Continue without backend in dev mode for UI testing
    if (!process.env.DRIFTER_SKIP_BACKEND) {
      app.quit();
      return;
    }
  }

  // Load config
  const config = loadConfig();

  // Create windows
  mainWindow = createMainWindow();
  petManager = createPetWindow(config);

  // Setup IPC
  setupIpc();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep app running if pet window is open (macOS behavior)
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Clean up backend process
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
});
