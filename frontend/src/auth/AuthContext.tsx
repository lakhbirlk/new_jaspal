import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ApiError, errorMessage, onUnauthorized } from '../api/client';
import * as api from '../api/endpoints';
import type { Access, AuthResponse, LoginResponse, MeResponse, UserSummary } from '../api/types';
import {
  clearTokens,
  getRefreshToken,
  hydrateTokens,
  setTokens,
} from './storage';

export type AuthPhase = 'initializing' | 'anonymous' | 'mfa' | 'mfa_setup' | 'authenticated';

export interface PendingChallenge {
  type: 'mfa' | 'mfa_setup';
  token: string;
  email: string;
}

export interface RegisterInput {
  email: string;
  fullName: string;
  password: string;
  role: 'researcher' | 'business';
  businessName?: string;
}

interface AuthContextValue {
  phase: AuthPhase;
  user: UserSummary | null;
  me: MeResponse | null;
  pending: PendingChallenge | null;
  loadingMe: boolean;
  meError: string | null;
  busy: boolean;
  lastError: string | null;
  login: (email: string, password: string) => Promise<LoginResponse>;
  verifyMfaCode: (code: string) => Promise<void>;
  beginMfaSetup: () => Promise<{ secret: string; otpauthUri: string }>;
  enableMfaCode: (code: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<{ devVerificationToken?: string }>;
  acceptInvitation: (token: string, password: string) => Promise<void>;
  cancelChallenge: () => void;
  refreshMe: () => Promise<void>;
  signOut: () => Promise<void>;
  can: (permission: string) => boolean;
  accessFor: (resource: string, field: string, unlocked?: boolean) => Access;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function messageFor(error: unknown): string {
  return errorMessage(error);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<AuthPhase>('initializing');
  const [user, setUser] = useState<UserSummary | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [pending, setPending] = useState<PendingChallenge | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [meError, setMeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reset = useCallback(async () => {
    await clearTokens();
    if (!mounted.current) return;
    setUser(null);
    setMe(null);
    setPending(null);
    setPhase('anonymous');
  }, []);

  useEffect(() => onUnauthorized(() => {
    void reset();
  }), [reset]);

  const loadMe = useCallback(async (): Promise<MeResponse | null> => {
    setLoadingMe(true);
    setMeError(null);
    try {
      const response = await api.fetchMe();
      if (!mounted.current) return response;
      setUser(response.user);
      setMe(response);
      setPhase('authenticated');
      return response;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await reset();
      } else if (mounted.current) {
        setMeError(messageFor(error));
      }
      return null;
    } finally {
      if (mounted.current) setLoadingMe(false);
    }
  }, [reset]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrateTokens();
      const token = getRefreshToken();
      if (!token) {
        if (!cancelled) setPhase('anonymous');
        return;
      }
      try {
        const response = await api.fetchMe();
        if (cancelled) return;
        setUser(response.user);
        setMe(response);
        setPhase('authenticated');
      } catch {
        if (cancelled) return;
        await clearTokens();
        setPhase('anonymous');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyAuth = useCallback(async (auth: AuthResponse) => {
    await setTokens(auth.accessToken, auth.refreshToken);
    if (!mounted.current) return;
    setUser(auth.user);
    setPhase('authenticated');
    setPending(null);
    await loadMe();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    setBusy(true);
    setLastError(null);
    try {
      const response = await api.login(email, password);
      if (!mounted.current) return response;
      if (response.status === 'authenticated') {
        await applyAuth(response);
      } else if (response.status === 'mfa_required') {
        setUser(response.user);
        setPending({ type: 'mfa', token: response.challengeToken, email });
        setPhase('mfa');
      } else {
        setUser(response.user);
        setPending({ type: 'mfa_setup', token: response.enrollmentToken, email });
        setPhase('mfa_setup');
      }
      return response;
    } catch (error) {
      if (mounted.current) setLastError(messageFor(error));
      throw error;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [applyAuth]);

  const verifyMfaCode = useCallback(async (code: string) => {
    if (!pending) throw new Error('No sign-in challenge is in progress');
    setBusy(true);
    setLastError(null);
    try {
      const response = await api.verifyMfa(pending.token, code.trim());
      await applyAuth(response);
    } catch (error) {
      if (mounted.current) setLastError(messageFor(error));
      throw error;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [pending, applyAuth]);

  const beginMfaSetup = useCallback(async () => {
    setBusy(true);
    setLastError(null);
    try {
      const enrollmentToken = pending?.type === 'mfa_setup' ? pending.token : undefined;
      return await api.setupMfa(enrollmentToken);
    } catch (error) {
      if (mounted.current) setLastError(messageFor(error));
      throw error;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [pending]);

  const enableMfaCode = useCallback(async (code: string) => {
    setBusy(true);
    setLastError(null);
    try {
      const enrollmentToken = pending?.type === 'mfa_setup' ? pending.token : undefined;
      const response = await api.enableMfa(code.trim(), enrollmentToken);
      await applyAuth(response);
    } catch (error) {
      if (mounted.current) setLastError(messageFor(error));
      throw error;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [pending, applyAuth]);

  const signUp = useCallback(async (input: RegisterInput) => {
    setBusy(true);
    setLastError(null);
    try {
      const response = await api.register(input);
      return { devVerificationToken: response.devVerificationToken };
    } catch (error) {
      if (mounted.current) setLastError(messageFor(error));
      throw error;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    await loadMe();
  }, [loadMe]);

  const acceptInvitation = useCallback(async (token: string, password: string) => {
    setBusy(true);
    setLastError(null);
    try {
      const response = await api.acceptInvite(token.trim(), password);
      if (!mounted.current) return;
      if (response.status === 'authenticated') {
        await applyAuth(response);
      } else if (response.status === 'mfa_setup_required') {
        setUser(response.user);
        setPending({ type: 'mfa_setup', token: response.enrollmentToken, email: response.user.email });
        setPhase('mfa_setup');
      } else {
        setUser(response.user);
        setPending({ type: 'mfa', token: response.challengeToken, email: response.user.email });
        setPhase('mfa');
      }
    } catch (error) {
      if (mounted.current) setLastError(messageFor(error));
      throw error;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [applyAuth]);

  const cancelChallenge = useCallback(() => {
    setPending(null);
    setUser(null);
    setPhase('anonymous');
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      const token = getRefreshToken();
      if (token) {
        await api.logout(token).catch(() => undefined);
      }
    } finally {
      await reset();
      if (mounted.current) setBusy(false);
    }
  }, [reset]);

  const can = useCallback((permission: string) => {
    return !!me?.permissions?.includes(permission);
  }, [me]);

  const accessFor = useCallback((resource: string, field: string, unlocked = false): Access => {
    const policies = me?.fieldPolicies;
    if (!policies) return 'hidden';
    const scoped = unlocked ? policies.unlocked : (policies.any ?? policies.locked);
    return scoped?.[field] ?? 'hidden';
  }, [me]);

  const clearError = useCallback(() => setLastError(null), []);

  const value = useMemo<AuthContextValue>(() => ({
    phase,
    user,
    me,
    pending,
    loadingMe,
    meError,
    busy,
    lastError,
    login,
    verifyMfaCode,
    beginMfaSetup,
    enableMfaCode,
    signUp,
    acceptInvitation,
    cancelChallenge,
    refreshMe,
    signOut,
    can,
    accessFor,
    clearError,
  }), [
    phase, user, me, pending, loadingMe, meError, busy, lastError, login, verifyMfaCode,
    beginMfaSetup, enableMfaCode, signUp, acceptInvitation, cancelChallenge, refreshMe, signOut,
    can, accessFor, clearError,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
