import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'bd_access_token';
const REFRESH_KEY = 'bd_refresh_token';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let hydrated = false;
let hydration: Promise<void> | null = null;

async function readItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Storage can be unavailable (private mode, locked keychain); the in-memory
    // session still works for this run.
  }
}

async function removeItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore storage failures on sign-out.
  }
}

export async function hydrateTokens(): Promise<void> {
  if (hydrated) return;
  if (!hydration) {
    hydration = (async () => {
      accessToken = await readItem(ACCESS_KEY);
      refreshToken = await readItem(REFRESH_KEY);
      hydrated = true;
    })();
  }
  await hydration;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  accessToken = access;
  refreshToken = refresh;
  hydrated = true;
  await Promise.all([writeItem(ACCESS_KEY, access), writeItem(REFRESH_KEY, refresh)]);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  hydrated = true;
  await Promise.all([removeItem(ACCESS_KEY), removeItem(REFRESH_KEY)]);
}
