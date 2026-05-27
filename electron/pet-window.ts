/**
 * Floating Pet Window Manager
 *
 * Creates and manages the always-on-top, transparent, frameless pet window.
 * Handles edge snapping, drag persistence, and notification states.
 *
 * This module is designed to be reusable — it can manage any floating overlay
 * window, not just the pet.
 */

import { BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';
import { DrifterConfig } from './config';

export interface PetPosition {
  edge: 'left' | 'right' | 'top' | 'bottom' | 'none';
  x: number;  // 0-1 relative position along the edge
  y: number;  // 0-1 relative position along the edge
}

export type PetAnimationState =
  | 'idle'
  | 'thinking'
  | 'has_news'
  | 'timer_done'
  | 'idea_connected';

export interface PetWindowOptions {
  defaultSize: number;       // Default window size in px (square)
  hoverSize: number;         // Size on hover
  edgeSnapThreshold: number; // Distance from edge to trigger snap (px)
  alwaysOnTop: boolean;
  transparent: boolean;
  frame: boolean;
  skipTaskbar: boolean;
}

const DEFAULT_OPTIONS: PetWindowOptions = {
  defaultSize: 72,
  hoverSize: 120,
  edgeSnapThreshold: 40,
  alwaysOnTop: true,
  transparent: true,
  frame: false,
  skipTaskbar: true,
};

export class PetWindowManager {
  private window: BrowserWindow | null = null;
  private options: PetWindowOptions;
  private position: PetPosition;
  private animationState: PetAnimationState = 'idle';
  private captureWindow: BrowserWindow | null = null;

  constructor(config: DrifterConfig, options?: Partial<PetWindowOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.position = config.pet ?? { edge: 'right', x: 0.95, y: 0.5 };
  }

  /**
   * Create the pet window and load the pet renderer.
   */
  create(): BrowserWindow {
    const { defaultSize, alwaysOnTop, transparent, frame, skipTaskbar } = this.options;

    this.window = new BrowserWindow({
      width: defaultSize,
      height: defaultSize,
      frame,
      transparent,
      alwaysOnTop,
      skipTaskbar,
      resizable: false,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Position the window
    this.restorePosition();

    // Load the pet renderer (same frontend, different route)
    if (process.env.NODE_ENV === 'development' || !(this.window as any).isPackaged) {
      this.window.loadURL('http://localhost:5173/pet');
    } else {
      this.window.loadFile(
        path.join(__dirname, '..', 'frontend', 'dist', 'index.html'),
        { hash: '/pet' }
      );
    }

    // Setup drag and edge snapping
    this.setupDragBehavior();

    // Setup hover resize
    this.setupHoverResize();

    this.window.on('closed', () => {
      this.window = null;
      if (this.captureWindow) {
        this.captureWindow.close();
        this.captureWindow = null;
      }
    });

    return this.window;
  }

  /**
   * Position the pet window based on saved edge/position.
   */
  private restorePosition(): void {
    if (!this.window) return;

    const { defaultSize } = this.options;
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    let x: number;
    let y: number;

    switch (this.position.edge) {
      case 'left':
        x = 0;
        y = Math.round(screenHeight * this.position.y - defaultSize / 2);
        break;
      case 'right':
        x = screenWidth - defaultSize;
        y = Math.round(screenHeight * this.position.y - defaultSize / 2);
        break;
      case 'top':
        x = Math.round(screenWidth * this.position.x - defaultSize / 2);
        y = 0;
        break;
      case 'bottom':
        x = Math.round(screenWidth * this.position.x - defaultSize / 2);
        y = screenHeight - defaultSize;
        break;
      default:
        // Free-floating: use absolute position
        x = Math.round(screenWidth * this.position.x - defaultSize / 2);
        y = Math.round(screenHeight * this.position.y - defaultSize / 2);
    }

    // Clamp to screen bounds
    x = Math.max(0, Math.min(x, screenWidth - defaultSize));
    y = Math.max(0, Math.min(y, screenHeight - defaultSize));

    this.window.setPosition(x, y);
  }

  /**
   * Setup drag behavior with edge snapping on release.
   */
  private setupDragBehavior(): void {
    if (!this.window) return;

    // Make the window draggable
    this.window.setIgnoreMouseEvents(false);

    // Listen for position changes from the renderer
    ipcMain.on('pet:drag-end', (_event, screenX: number, screenY: number) => {
      this.snapToEdge(screenX, screenY);
    });
  }

  /**
   * Snap the pet to the nearest screen edge if within threshold.
   */
  private snapToEdge(x: number, y: number): void {
    if (!this.window) return;

    const { edgeSnapThreshold, defaultSize } = this.options;
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const distToLeft = x;
    const distToRight = screenWidth - x - defaultSize;
    const distToTop = y;
    const distToBottom = screenHeight - y - defaultSize;

    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

    let newEdge: PetPosition['edge'] = 'none';
    let newX = x;
    let newY = y;

    if (minDist <= edgeSnapThreshold) {
      if (minDist === distToLeft) {
        newEdge = 'left';
        newX = 0;
        newY = y;
      } else if (minDist === distToRight) {
        newEdge = 'right';
        newX = screenWidth - defaultSize;
        newY = y;
      } else if (minDist === distToTop) {
        newEdge = 'top';
        newX = x;
        newY = 0;
      } else if (minDist === distToBottom) {
        newEdge = 'bottom';
        newX = x;
        newY = screenHeight - defaultSize;
      }

      this.window.setPosition(newX, newY);

      // Save relative position for restoration
      const relPos: PetPosition = {
        edge: newEdge,
        x: newEdge === 'left' || newEdge === 'right'
          ? newY / screenHeight
          : newX / screenWidth,
        y: newEdge === 'left' || newEdge === 'right'
          ? newY / screenHeight
          : newX / screenWidth,
      };

      // Fix: properly compute relative position
      if (newEdge === 'left' || newEdge === 'right') {
        relPos.y = newY / screenHeight;
        relPos.x = 0.5; // doesn't matter for vertical edges
      } else {
        relPos.x = newX / screenWidth;
        relPos.y = 0.5; // doesn't matter for horizontal edges
      }

      this.position = relPos;
    }
  }

  /**
   * Setup hover resize with smooth animation.
   */
  private setupHoverResize(): void {
    if (!this.window) return;

    this.window.on('enter-full-screen', () => {
      // Don't resize on full screen enter
    });

    // Hover resize is handled by the renderer via CSS
    // The window size stays constant; the SVG scales
  }

  /**
   * Open the Quick Capture panel.
   * Creates a small pill-shaped window adjacent to the pet.
   */
  openQuickCapture(): void {
    if (this.captureWindow) {
      this.captureWindow.focus();
      return;
    }

    if (!this.window) return;

    const [petX, petY] = this.window.getPosition();
    const { defaultSize } = this.options;

    this.captureWindow = new BrowserWindow({
      width: 360,
      height: 56,
      x: petX - 360 + defaultSize, // Position to the left of the pet
      y: petY + (defaultSize - 56) / 2, // Center vertically with pet
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    if (process.env.NODE_ENV === 'development' || !(this.captureWindow as any).isPackaged) {
      this.captureWindow.loadURL('http://localhost:5173/capture-panel');
    } else {
      this.captureWindow.loadFile(
        path.join(__dirname, '..', 'frontend', 'dist', 'index.html'),
        { hash: '/capture-panel' }
      );
    }

    this.captureWindow.on('closed', () => {
      this.captureWindow = null;
    });

    // Auto-close after 30 seconds of inactivity
    setTimeout(() => {
      if (this.captureWindow && !this.captureWindow.isDestroyed()) {
        this.captureWindow.close();
      }
    }, 30000);
  }

  /**
   * Set the pet's animation state.
   */
  setAnimationState(state: PetAnimationState): void {
    this.animationState = state;
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('pet:animation-state', state);
    }
  }

  /**
   * Get the current animation state.
   */
  getAnimationState(): PetAnimationState {
    return this.animationState;
  }

  /**
   * Get the pet window instance.
   */
  getWindow(): BrowserWindow | null {
    return this.window;
  }

  /**
   * Close the pet window and clean up.
   */
  close(): void {
    if (this.captureWindow && !this.captureWindow.isDestroyed()) {
      this.captureWindow.close();
    }
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
  }
}

/**
 * Factory function to create a pet window manager.
 */
export function createPetWindow(config: DrifterConfig): PetWindowManager {
  const manager = new PetWindowManager(config);
  manager.create();
  return manager;
}
