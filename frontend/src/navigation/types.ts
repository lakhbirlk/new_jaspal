import type { NavigatorScreenParams } from '@react-navigation/native';

export type PublicStackParamList = {
  Landing: undefined;
  Login: undefined;
  Register: undefined;
  VerifyEmail: { token?: string; email?: string } | undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetPassword: { token?: string } | undefined;
  AcceptInvite: { token?: string } | undefined;
};

export type ChallengeStackParamList = {
  MfaVerify: undefined;
  MfaSetup: undefined;
};

export type OnboardingStackParamList = {
  OnboardingHome: undefined;
  ResearcherProfileEdit: undefined;
  BusinessEdit: undefined;
  Documents: undefined;
  Account: undefined;
};

export type ResearcherTabParamList = {
  Search: { q?: string; industry?: string; city?: string } | undefined;
  Unlocked: undefined;
  Subscription: undefined;
  Profile: undefined;
};

export type ResearcherStackParamList = {
  ResearcherTabs: NavigatorScreenParams<ResearcherTabParamList> | undefined;
  BusinessDetail: { id: string; title?: string };
  Plans: undefined;
  Ledger: undefined;
  SavedSearches: undefined;
  Account: undefined;
};

export type BusinessTabParamList = {
  Overview: undefined;
  Documents: undefined;
  Listing: undefined;
  Account: undefined;
};

export type BusinessStackParamList = {
  BusinessTabs: NavigatorScreenParams<BusinessTabParamList> | undefined;
  Plans: undefined;
};

export type AuditorTabParamList = {
  Businesses: undefined;
  Account: undefined;
};

export type AuditorStackParamList = {
  AuditorTabs: NavigatorScreenParams<AuditorTabParamList> | undefined;
  BusinessDetail: { id: string; title?: string };
};

export type AdminTabParamList = {
  Dashboard: undefined;
  Users: undefined;
  Businesses: undefined;
  More: undefined;
};

export type AdminStackParamList = {
  AdminTabs: NavigatorScreenParams<AdminTabParamList> | undefined;
  UserDetail: { id: string; email?: string };
  PolicyOverrides: { userId: string; email?: string };
  AdminBusinessDetail: { id: string; title?: string };
  Documents: undefined;
  Plans: undefined;
  Subscriptions: undefined;
  Listings: undefined;
  Payments: undefined;
  Policies: undefined;
  AuditLogs: undefined;
  Settings: undefined;
  Account: undefined;
};
