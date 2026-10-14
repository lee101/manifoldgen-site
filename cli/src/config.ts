import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_BASE_URL = 'https://manifoldgen.com';

export interface StoredConfig {
  api_key?: string;
  email?: string;
  base_url?: string;
}

export type Env = Record<string, string | undefined>;

export function configDir(env: Env): string {
  if (env.MANIFOLDGEN_CONFIG_DIR) return env.MANIFOLDGEN_CONFIG_DIR;
  return join(env.XDG_CONFIG_HOME || join(env.HOME || homedir(), '.config'), 'manifoldgen');
}

export function configPath(env: Env): string {
  return join(configDir(env), 'config.json');
}

export function readConfig(env: Env): StoredConfig {
  const path = configPath(env);
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeConfig(env: Env, config: StoredConfig) {
  const dir = configDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = configPath(env);
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function clearConfigKey(env: Env): boolean {
  const config = readConfig(env);
  if (!config.api_key) return false;
  delete config.api_key;
  delete config.email;
  if (Object.keys(config).length === 0) rmSync(configPath(env), { force: true });
  else writeConfig(env, config);
  return true;
}

export interface Credentials {
  apiKey?: string;
  source: 'env' | 'config' | 'none';
  baseUrl: string;
  email?: string;
}

export function resolveCredentials(env: Env): Credentials {
  const config = readConfig(env);
  const baseUrl = (env.MANIFOLDGEN_BASE_URL || config.base_url || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const envKey = env.MANIFOLDGEN_API_KEY?.trim();
  if (envKey) return { apiKey: envKey, source: 'env', baseUrl };
  if (config.api_key) return { apiKey: config.api_key, source: 'config', baseUrl, email: config.email };
  return { source: 'none', baseUrl };
}
