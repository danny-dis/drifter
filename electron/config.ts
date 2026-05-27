/**
 * Configuration Management
 *
 * Handles loading, saving, and validating the Drifter config file.
 * Config is stored at ~/.drifter/config.json (or platform equivalent).
 *
 * This module is reusable — it can be imported by any part of the app
 * that needs to read/write user configuration.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CompanionConfig {
  name: string;
  character: string;
  createdAt: string;
}

export interface PetConfig {
  edge: 'left' | 'right' | 'top' | 'bottom' | 'none';
  x: number;
  y: number;
}

export interface LLMProviderConfig {
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'ollama';
  apiKey: string;
  baseUrl?: string;
  models: string[];
}

export interface RoleAssignment {
  role: string;
  providerName: string;
  model: string;
}

export interface DrifterConfig {
  version: number;
  onboardingComplete: boolean;
  companion: CompanionConfig | null;
  pet: PetConfig;
  llm: {
    providers: LLMProviderConfig[];
    roles: Record<string, RoleAssignment>;
  };
  subAgents: {
    maxConcurrent: number;
  };
  notifications: {
    cooldownSeconds: number;
    soundEnabled: boolean;
  };
}

const DEFAULT_CONFIG: DrifterConfig = {
  version: 1,
  onboardingComplete: false,
  companion: null,
  pet: { edge: 'right', x: 0.95, y: 0.5 },
  llm: {
    providers: [],
    roles: {},
  },
  subAgents: {
    maxConcurrent: 3,
  },
  notifications: {
    cooldownSeconds: 3600,
    soundEnabled: false,
  },
};

/**
 * Get the path to the Drifter config directory.
 * Platform-aware: uses ~/.drifter on Unix, %APPDATA%/Drifter on Windows.
 */
export function getConfigDir(): string {
  const home = os.homedir();

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'Drifter');
  }

  return path.join(home, '.drifter');
}

/**
 * Get the full path to the config file.
 */
export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

/**
 * Load the config from disk.
 * Returns default config if file doesn't exist or is invalid.
 */
export function loadConfig(): DrifterConfig {
  const configPath = getConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      return { ...DEFAULT_CONFIG };
    }

    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DrifterConfig>;

    // Merge with defaults to handle missing fields
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    console.error('Failed to load config:', err);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save the config to disk.
 * Creates the config directory if it doesn't exist.
 */
export function saveConfig(config: DrifterConfig): void {
  const configDir = getConfigDir();

  // Ensure directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Update a nested field in the config and save.
 * Uses a simple dot-path notation: "companion.name", "pet.edge", etc.
 */
export function updateConfigField(path: string, value: unknown): DrifterConfig {
  const config = loadConfig();
  const parts = path.split('.');

  let current: Record<string, unknown> = config as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  saveConfig(config);
  return config;
}
