import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui';
import { colors, layout, spacing, typography } from '../theme';
import type {
  AdminStackParamList,
  AdminTabParamList,
  AuditorStackParamList,
  AuditorTabParamList,
  BusinessStackParamList,
  BusinessTabParamList,
  ChallengeStackParamList,
  OnboardingStackParamList,
  PublicStackParamList,
  ResearcherStackParamList,
  ResearcherTabParamList,
} from './types';

import LandingScreen from '../screens/public/LandingScreen';
import CompanyDatabaseScreen from '../screens/public/CompanyDatabaseScreen';
import PublicBusinessDetailScreen from '../screens/public/PublicBusinessDetailScreen';
import LoginScreen from '../screens/public/LoginScreen';
import RegisterScreen from '../screens/public/RegisterScreen';
import VerifyEmailScreen from '../screens/public/VerifyEmailScreen';
import ForgotPasswordScreen from '../screens/public/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/public/ResetPasswordScreen';
import AcceptInviteScreen from '../screens/public/AcceptInviteScreen';
import MfaVerifyScreen from '../screens/public/MfaVerifyScreen';
import MfaSetupScreen from '../screens/public/MfaSetupScreen';
import OnboardingHomeScreen from '../screens/onboarding/OnboardingHomeScreen';
import ResearcherProfileScreen from '../screens/researcher/ResearcherProfileScreen';
import SearchScreen from '../screens/researcher/SearchScreen';
import UnlockedScreen from '../screens/researcher/UnlockedScreen';
import SubscriptionScreen from '../screens/researcher/SubscriptionScreen';
import PlansScreen from '../screens/researcher/PlansScreen';
import CheckoutScreen from '../screens/researcher/CheckoutScreen';
import LedgerScreen from '../screens/researcher/LedgerScreen';
import SavedSearchesScreen from '../screens/researcher/SavedSearchesScreen';
import BusinessEditScreen from '../screens/business/BusinessEditScreen';
import ListingScreen from '../screens/business/ListingScreen';
import AuditorBusinessListScreen from '../screens/auditor/AuditorBusinessListScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminBusinessesScreen from '../screens/admin/AdminBusinessesScreen';
import AdminMoreScreen from '../screens/admin/AdminMoreScreen';
import UserDetailScreen from '../screens/admin/UserDetailScreen';
import PolicyOverridesScreen from '../screens/admin/PolicyOverridesScreen';
import AdminBusinessDetailScreen from '../screens/admin/AdminBusinessDetailScreen';
import AdminDocumentsScreen from '../screens/admin/AdminDocumentsScreen';
import AdminPlansScreen from '../screens/admin/AdminPlansScreen';
import AdminSubscriptionsScreen from '../screens/admin/AdminSubscriptionsScreen';
import AdminListingsScreen from '../screens/admin/AdminListingsScreen';
import AdminPaymentsScreen from '../screens/admin/AdminPaymentsScreen';
import AdminPoliciesScreen from '../screens/admin/AdminPoliciesScreen';
import AdminAuditLogsScreen from '../screens/admin/AdminAuditLogsScreen';
import AdminSettingsScreen from '../screens/admin/AdminSettingsScreen';
import AccountScreen from '../screens/shared/AccountScreen';
import MyDocumentsScreen from '../screens/shared/MyDocumentsScreen';
import BusinessDetailScreen from '../screens/shared/BusinessDetailScreen';
import CompanyProfileScreen from '../screens/researcher/CompanyProfileScreen';

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.primaryDark,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

function HeaderSignOut() {
  const { signOut, busy } = useAuth();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      disabled={busy}
      onPress={() => { void signOut(); }}
      hitSlop={8}
      style={({ pressed }) => [styles.headerSignOut, (pressed || busy) && { opacity: 0.6 }]}
    >
      <Text style={styles.headerSignOutText}>Sign out</Text>
    </Pressable>
  );
}

// Native stack screens inside a signed-in workspace get the sign-out action in
// the header; the public stack keeps its default header options.
const signedInStackOptions = {
  ...stackScreenOptions,
  headerRight: () => <HeaderSignOut />,
};

const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.muted,
  tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const },
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: layout.tabBarHeight,
    paddingBottom: 6,
    paddingTop: 6,
  },
};

// ------------------------------------------------------------------ tabs

function tabIcon(letter: string) {
  return function TabIcon({ color, focused }: { color: string; focused: boolean }) {
    return (
      <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
        <Text style={[styles.tabIconText, { color }]}>{letter}</Text>
      </View>
    );
  };
}

// ------------------------------------------------------------------ wrappers

function OnboardingResearcherProfile() {
  return <ResearcherProfileScreen topInset={false} />;
}

function OnboardingBusinessEdit() {
  return <BusinessEditScreen topInset={false} />;
}

function OnboardingDocuments() {
  return <MyDocumentsScreen topInset={false} />;
}

function BusinessOverviewTab() {
  return <BusinessEditScreen topInset={false} />;
}

function BusinessDocumentsTab() {
  return <MyDocumentsScreen topInset={false} />;
}

function ResearcherProfileTab() {
  return <ResearcherProfileScreen showAccountLink topInset={false} />;
}

// ------------------------------------------------------------------ signed-in bar

/**
 * Tab screens do not use a native header, so they get a thin top bar that keeps
 * the sign-out action in the upper-right on every workspace screen. The bar
 * consumes the top safe-area inset, so the wrapped screen is told its top inset
 * is zero to avoid doubling the status-bar padding.
 */
function withSignOutBar<P extends object>(Component: React.ComponentType<P>) {
  function WithSignOutBar(props: P) {
    const insets = useSafeAreaInsets();
    const { signOut, busy } = useAuth();
    return (
      <View style={styles.workspace}>
        <View style={[styles.workspaceBar, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.workspaceBrand}>DataOfBusiness</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            disabled={busy}
            onPress={() => { void signOut(); }}
            hitSlop={8}
            style={({ pressed }) => [styles.signOutButton, (pressed || busy) && { opacity: 0.6 }]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
        <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
          <View style={styles.workspaceBody}>
            <Component {...props} />
          </View>
        </SafeAreaInsetsContext.Provider>
      </View>
    );
  }
  WithSignOutBar.displayName = `WithSignOutBar(${Component.displayName ?? Component.name ?? 'Screen'})`;
  return WithSignOutBar;
}

const ResearcherSearchTab = withSignOutBar(SearchScreen);
const ResearcherUnlockedTab = withSignOutBar(UnlockedScreen);
const ResearcherSubscriptionTab = withSignOutBar(SubscriptionScreen);
const ResearcherProfileScreenTab = withSignOutBar(ResearcherProfileTab);
const BusinessOverviewScreenTab = withSignOutBar(BusinessOverviewTab);
const BusinessDocumentsScreenTab = withSignOutBar(BusinessDocumentsTab);
const BusinessListingTab = withSignOutBar(ListingScreen);
const BusinessAccountTab = withSignOutBar(AccountScreen);
const AuditorBusinessesTab = withSignOutBar(AuditorBusinessListScreen);
const AuditorAccountTab = withSignOutBar(AccountScreen);
const AdminDashboardTab = withSignOutBar(AdminDashboardScreen);
const AdminUsersTab = withSignOutBar(AdminUsersScreen);
const AdminBusinessesTab = withSignOutBar(AdminBusinessesScreen);
const AdminPaymentsTab = withSignOutBar(AdminPaymentsScreen);
const AdminMoreTab = withSignOutBar(AdminMoreScreen);

// ------------------------------------------------------------------ stacks

const PublicStack = createNativeStackNavigator<PublicStackParamList>();

type PublicEntry = 'AcceptInvite' | 'ResetPassword' | 'VerifyEmail' | 'Login' | 'Register' | 'ForgotPassword';

const publicEmailRoutes: Record<string, PublicEntry> = {
  '/accept-invite': 'AcceptInvite',
  '/reset-password': 'ResetPassword',
  '/verify-email': 'VerifyEmail',
  '/login': 'Login',
  '/register': 'Register',
  '/forgot-password': 'ForgotPassword',
};

/**
 * Email links point at web paths such as /accept-invite?token=…. On the web build,
 * open the matching public screen with the token prefilled. The path is cleared so
 * that signing out later returns to the normal landing page.
 */
function readPublicEntry(): { name: PublicEntry; token?: string } | null {
  if (Platform.OS !== 'web') return null;
  const scope = globalThis as unknown as {
    location?: { pathname?: string; search?: string };
    history?: { replaceState: (data: unknown, unused: string, url?: string) => void };
  };
  const path = scope.location?.pathname?.replace(/\/+$/, '') ?? '';
  const name = publicEmailRoutes[path];
  if (!name) return null;
  const token = new URLSearchParams(scope.location?.search ?? '').get('token') ?? undefined;
  try {
    scope.history?.replaceState(null, '', '/');
  } catch {
    // History is unavailable (for example in a restricted webview); keep the URL.
  }
  return { name, token };
}

function PublicNavigator() {
  const entry = readPublicEntry();
  return (
    <PublicStack.Navigator initialRouteName={entry?.name ?? 'Landing'} screenOptions={stackScreenOptions}>
      <PublicStack.Screen
        name="Landing"
        component={LandingScreen}
        options={{ headerShown: false, title: 'DataOfBusiness' }}
      />
      <PublicStack.Screen
        name="CompanyDatabase"
        component={CompanyDatabaseScreen}
        options={{ title: 'Company database' }}
      />
      <PublicStack.Screen
        name="PublicBusinessDetail"
        component={PublicBusinessDetailScreen}
        options={({ route }) => ({ title: route.params.publicCode ?? 'Company profile' })}
      />
      <PublicStack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
      <PublicStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
      <PublicStack.Screen
        name="VerifyEmail"
        component={VerifyEmailScreen}
        options={{ title: 'Verify email' }}
        initialParams={entry?.name === 'VerifyEmail' ? { token: entry.token } : undefined}
      />
      <PublicStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset password' }} />
      <PublicStack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ title: 'Choose a new password' }}
        initialParams={entry?.name === 'ResetPassword' ? { token: entry.token } : undefined}
      />
      <PublicStack.Screen
        name="AcceptInvite"
        component={AcceptInviteScreen}
        options={{ title: 'Accept invitation' }}
        initialParams={entry?.name === 'AcceptInvite' ? { token: entry.token } : undefined}
      />
    </PublicStack.Navigator>
  );
}

const ChallengeStack = createNativeStackNavigator<ChallengeStackParamList>();

function ChallengeNavigator({ initialRoute }: { initialRoute: 'MfaVerify' | 'MfaSetup' }) {
  return (
    <ChallengeStack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ ...stackScreenOptions, headerShown: false }}
    >
      <ChallengeStack.Screen name="MfaVerify" component={MfaVerifyScreen} />
      <ChallengeStack.Screen name="MfaSetup" component={MfaSetupScreen} />
    </ChallengeStack.Navigator>
  );
}

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={signedInStackOptions}>
      <OnboardingStack.Screen
        name="OnboardingHome"
        component={OnboardingHomeScreen}
        options={{ title: 'Complete your profile' }}
      />
      <OnboardingStack.Screen
        name="ResearcherProfileEdit"
        component={OnboardingResearcherProfile}
        options={{ title: 'Profile details' }}
      />
      <OnboardingStack.Screen
        name="BusinessEdit"
        component={OnboardingBusinessEdit}
        options={{ title: 'Business profile' }}
      />
      <OnboardingStack.Screen
        name="Documents"
        component={OnboardingDocuments}
        options={{ title: 'Documents' }}
      />
      <OnboardingStack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
    </OnboardingStack.Navigator>
  );
}

// ------------------------------------------------------------------ researcher

const ResearcherTabs = createBottomTabNavigator<ResearcherTabParamList>();

function ResearcherTabNavigator() {
  return (
    <ResearcherTabs.Navigator screenOptions={tabScreenOptions}>
      <ResearcherTabs.Screen
        name="Search"
        component={ResearcherSearchTab}
        options={{ title: 'Search', tabBarIcon: tabIcon('S') }}
      />
      <ResearcherTabs.Screen
        name="Unlocked"
        component={ResearcherUnlockedTab}
        options={{ title: 'Unlocked', tabBarIcon: tabIcon('U') }}
      />
      <ResearcherTabs.Screen
        name="Subscription"
        component={ResearcherSubscriptionTab}
        options={{ title: 'Credits', tabBarIcon: tabIcon('C') }}
      />
      <ResearcherTabs.Screen
        name="Profile"
        component={ResearcherProfileScreenTab}
        options={{ title: 'Profile', tabBarIcon: tabIcon('P') }}
      />
    </ResearcherTabs.Navigator>
  );
}

const ResearcherStack = createNativeStackNavigator<ResearcherStackParamList>();

function ResearcherNavigator() {
  return (
    <ResearcherStack.Navigator screenOptions={signedInStackOptions}>
      <ResearcherStack.Screen
        name="ResearcherTabs"
        component={ResearcherTabNavigator}
        options={{ headerShown: false }}
      />
      <ResearcherStack.Screen
        name="BusinessDetail"
        component={CompanyProfileScreen}
        options={({ route }) => ({ title: route.params.title ?? 'Company profile' })}
      />
      <ResearcherStack.Screen name="Plans" component={PlansScreen} options={{ title: 'Plans & credits' }} />
      <ResearcherStack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ title: 'Checkout' }}
      />
      <ResearcherStack.Screen name="Ledger" component={LedgerScreen} options={{ title: 'Credit ledger' }} />
      <ResearcherStack.Screen
        name="SavedSearches"
        component={SavedSearchesScreen}
        options={{ title: 'Saved searches' }}
      />
      <ResearcherStack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
    </ResearcherStack.Navigator>
  );
}

// ------------------------------------------------------------------ business

const BusinessTabs = createBottomTabNavigator<BusinessTabParamList>();

function BusinessTabNavigator() {
  return (
    <BusinessTabs.Navigator screenOptions={tabScreenOptions}>
      <BusinessTabs.Screen
        name="Overview"
        component={BusinessOverviewScreenTab}
        options={{ title: 'Profile', tabBarIcon: tabIcon('B') }}
      />
      <BusinessTabs.Screen
        name="Documents"
        component={BusinessDocumentsScreenTab}
        options={{ title: 'Documents', tabBarIcon: tabIcon('D') }}
      />
      <BusinessTabs.Screen
        name="Listing"
        component={BusinessListingTab}
        options={{ title: 'Listing', tabBarIcon: tabIcon('L') }}
      />
      <BusinessTabs.Screen
        name="Account"
        component={BusinessAccountTab}
        options={{ title: 'Account', tabBarIcon: tabIcon('A') }}
      />
    </BusinessTabs.Navigator>
  );
}

const BusinessStack = createNativeStackNavigator<BusinessStackParamList>();

function BusinessNavigator() {
  return (
    <BusinessStack.Navigator screenOptions={signedInStackOptions}>
      <BusinessStack.Screen
        name="BusinessTabs"
        component={BusinessTabNavigator}
        options={{ headerShown: false }}
      />
      <BusinessStack.Screen name="Plans" component={PlansScreen} options={{ title: 'Listing plans' }} />
    </BusinessStack.Navigator>
  );
}

// ------------------------------------------------------------------ auditor

const AuditorTabs = createBottomTabNavigator<AuditorTabParamList>();

function AuditorTabNavigator() {
  return (
    <AuditorTabs.Navigator screenOptions={tabScreenOptions}>
      <AuditorTabs.Screen
        name="Businesses"
        component={AuditorBusinessesTab}
        options={{ title: 'Businesses', tabBarIcon: tabIcon('B') }}
      />
      <AuditorTabs.Screen
        name="Account"
        component={AuditorAccountTab}
        options={{ title: 'Account', tabBarIcon: tabIcon('A') }}
      />
    </AuditorTabs.Navigator>
  );
}

const AuditorStack = createNativeStackNavigator<AuditorStackParamList>();

function AuditorNavigator() {
  return (
    <AuditorStack.Navigator screenOptions={signedInStackOptions}>
      <AuditorStack.Screen
        name="AuditorTabs"
        component={AuditorTabNavigator}
        options={{ headerShown: false }}
      />
      <AuditorStack.Screen
        name="BusinessDetail"
        component={BusinessDetailScreen}
        options={({ route }) => ({ title: route.params.title ?? 'Business profile' })}
      />
    </AuditorStack.Navigator>
  );
}

// ------------------------------------------------------------------ admin

const AdminTabs = createBottomTabNavigator<AdminTabParamList>();

function AdminTabNavigator() {
  return (
    <AdminTabs.Navigator screenOptions={tabScreenOptions}>
      <AdminTabs.Screen
        name="Dashboard"
        component={AdminDashboardTab}
        options={{ title: 'Dashboard', tabBarIcon: tabIcon('D') }}
      />
      <AdminTabs.Screen
        name="Users"
        component={AdminUsersTab}
        options={{ title: 'Users', tabBarIcon: tabIcon('U') }}
      />
      <AdminTabs.Screen
        name="Businesses"
        component={AdminBusinessesTab}
        options={{ title: 'Businesses', tabBarIcon: tabIcon('B') }}
      />
      <AdminTabs.Screen
        name="Payments"
        component={AdminPaymentsTab}
        options={{ title: 'Payments', tabBarIcon: tabIcon('P') }}
      />
      <AdminTabs.Screen
        name="More"
        component={AdminMoreTab}
        options={{ title: 'More', tabBarIcon: tabIcon('M') }}
      />
    </AdminTabs.Navigator>
  );
}

const AdminStack = createNativeStackNavigator<AdminStackParamList>();

function AdminNavigator() {
  return (
    <AdminStack.Navigator screenOptions={signedInStackOptions}>
      <AdminStack.Screen name="AdminTabs" component={AdminTabNavigator} options={{ headerShown: false }} />
      <AdminStack.Screen name="UserDetail" component={UserDetailScreen} options={{ title: 'User' }} />
      <AdminStack.Screen
        name="PolicyOverrides"
        component={PolicyOverridesScreen}
        options={{ title: 'Policy overrides' }}
      />
      <AdminStack.Screen
        name="AdminBusinessDetail"
        component={AdminBusinessDetailScreen}
        options={({ route }) => ({ title: route.params.title ?? 'Business' })}
      />
      <AdminStack.Screen name="Documents" component={AdminDocumentsScreen} options={{ title: 'Document review' }} />
      <AdminStack.Screen name="Plans" component={AdminPlansScreen} options={{ title: 'Plans' }} />
      <AdminStack.Screen name="Subscriptions" component={AdminSubscriptionsScreen} options={{ title: 'Subscriptions' }} />
      <AdminStack.Screen name="Listings" component={AdminListingsScreen} options={{ title: 'Listings' }} />
      <AdminStack.Screen name="Payments" component={AdminPaymentsScreen} options={{ title: 'Payments' }} />
      <AdminStack.Screen name="Policies" component={AdminPoliciesScreen} options={{ title: 'Visibility policies' }} />
      <AdminStack.Screen name="AuditLogs" component={AdminAuditLogsScreen} options={{ title: 'Audit trail' }} />
      <AdminStack.Screen name="Settings" component={AdminSettingsScreen} options={{ title: 'Settings' }} />
      <AdminStack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
    </AdminStack.Navigator>
  );
}

// ------------------------------------------------------------------ gate

function Splash({ message }: { message?: string }) {
  return (
    <View style={styles.splash}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>DoB</Text>
      </View>
      <Text style={styles.brand}>DataOfBusiness</Text>
      {message ? <Text style={styles.splashMessage}>{message}</Text> : <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />}
    </View>
  );
}

function Workspace() {
  const { phase, me, user, meError, refreshMe, signOut } = useAuth();

  if (phase === 'initializing') return <Splash message="Restoring your session…" />;
  if (phase === 'anonymous') return <PublicNavigator />;
  if (phase === 'mfa') return <ChallengeNavigator key="mfa" initialRoute="MfaVerify" />;
  if (phase === 'mfa_setup') return <ChallengeNavigator key="mfa_setup" initialRoute="MfaSetup" />;

  if (!user) return <Splash message="Loading your account…" />;
  if (!me) {
    return (
      <View style={styles.splash}>
        <Text style={typography.h2}>We could not load your account</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.sm, textAlign: 'center' }]}>
          {meError ?? 'Check your connection and try again.'}
        </Text>
        <Button title="Try again" onPress={() => { void refreshMe(); }} style={{ marginTop: spacing.lg }} />
        <Button title="Sign out" variant="ghost" onPress={() => { void signOut(); }} />
      </View>
    );
  }

  if (me.restricted || user.restricted) return <OnboardingNavigator />;

  switch (user.role) {
    case 'researcher':
      return <ResearcherNavigator />;
    case 'business':
      return <BusinessNavigator />;
    case 'auditor':
      return <AuditorNavigator />;
    case 'admin':
      return <AdminNavigator />;
    default:
      return (
        <View style={styles.splash}>
          <Text style={typography.h2}>Unsupported role</Text>
          <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>
            This account does not have access to a workspace.
          </Text>
          <Button title="Sign out" variant="secondary" onPress={() => { void signOut(); }} style={{ marginTop: spacing.lg }} />
        </View>
      );
  }
}

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Workspace />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: colors.white, fontWeight: '800', fontSize: 19, letterSpacing: 0.5 },
  brand: { ...typography.title, marginTop: spacing.md },
  splashMessage: { ...typography.small, marginTop: spacing.sm, textAlign: 'center' },
  tabIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: { backgroundColor: colors.primarySoft },
  tabIconText: { fontSize: 12, fontWeight: '800' },
  workspace: { flex: 1, backgroundColor: colors.background },
  workspaceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  workspaceBrand: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.2,
  },
  workspaceBody: { flex: 1 },
  signOutButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#C9CFE0',
  },
  signOutText: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  headerSignOut: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  headerSignOutText: { fontSize: 14, fontWeight: '600', color: colors.primary },
});
