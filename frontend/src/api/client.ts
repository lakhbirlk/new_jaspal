import { Platform } from 'react-native';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  hydrateTokens,
  setTokens,
} from '../auth/storage';

const fallbackBase = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

// Set EXPO_PUBLIC_API_URL="/" when the web build is served by the API itself: the trailing
// slash is stripped, leaving a relative base so requests go to /api/v1/... on the same origin.
export const API_BASE: string = (
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  fallbackBase
).replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized(): void {
  unauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Listener failures should not break the caller.
    }
  });
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function isFormData(value: unknown): boolean {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

async function parseError(response: Response): Promise<ApiError> {
  let code = `HTTP_${response.status}`;
  let message = response.statusText || 'The request failed';
  let details: unknown;
  try {
    const data = await response.json();
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (typeof record.code === 'string') code = record.code;
      if (typeof record.message === 'string') message = record.message;
      details = record.details;
    }
  } catch {
    // Response was not JSON.
  }
  return new ApiError(response.status, code, message, details);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const token = getRefreshToken();
  if (!token) return false;
  const attempt = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { accessToken?: string; refreshToken?: string };
      if (!data.accessToken || !data.refreshToken) return false;
      await setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  refreshInFlight = attempt;
  return attempt;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  await hydrateTokens();
  const isAuthEndpoint = path.startsWith('/auth/');
  const headers: Record<string, string> = { Accept: 'application/json', ...(options.headers ?? {}) };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (isFormData(options.body)) {
      body = options.body as FormData;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/v1${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body,
      signal: options.signal,
    });
  } catch (error) {
    throw new ApiError(0, 'NETWORK_ERROR',
      `Cannot reach the server at ${API_BASE}. Check your connection and API URL.`, error);
  }

  if (response.status === 401 && !isAuthEndpoint && !retried) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiRequest<T>(path, options, true);
    }
    await clearTokens();
    notifyUnauthorized();
  }

  if (!response.ok) {
    throw await parseError(response);
  }
  return parseResponse<T>(response);
}

export async function apiBlob(path: string): Promise<Blob> {
  await hydrateTokens();
  const token = getAccessToken();
  let response = await fetch(`${API_BASE}/api/v1${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const nextToken = getAccessToken();
      response = await fetch(`${API_BASE}/api/v1${path}`, {
        headers: nextToken ? { Authorization: `Bearer ${nextToken}` } : undefined,
      });
    }
  }
  if (!response.ok) throw await parseError(response);
  return response.blob();
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts: string[] = [];
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.message;
    if (error.details && typeof error.details === 'object') {
      const detail = error.details as Record<string, unknown>;
      if (typeof detail.message === 'string') return detail.message;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
