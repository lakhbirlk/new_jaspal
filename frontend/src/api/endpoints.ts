import { apiBlob, apiRequest, buildQuery } from './client';
import type {
  AdminDashboard,
  AdminSubscriptionList,
  AdminUser,
  AuditLogEntry,
  AuthResponse,
  BusinessRecord,
  Completion,
  DocumentSummary,
  LedgerEntry,
  ListingSubscription,
  LoginResponse,
  MeResponse,
  MyListing,
  MySubscription,
  PageResult,
  Payment,
  Plan,
  PolicyOverride,
  PolicyRow,
  ProfileRequirement,
  ResearcherProfile,
  SavedSearch,
  SettingsMap,
  Subscription,
  UnlockedBusiness,
  UserSummary,
} from './types';

// ---------------------------------------------------------------- auth

export function login(email: string, password: string) {
  return apiRequest<LoginResponse>('/auth/login', { body: { email, password } });
}

export function register(payload: {
  email: string;
  fullName: string;
  password: string;
  role: 'researcher' | 'business';
  businessName?: string;
}) {
  return apiRequest<{
    userId: string;
    status: string;
    message: string;
    devVerificationToken?: string;
  }>('/auth/register', { body: payload });
}

export function verifyEmail(token: string) {
  return apiRequest<{ status: string; message: string }>('/auth/verify-email', { body: { token } });
}

export function verifyMfa(challengeToken: string, code: string) {
  return apiRequest<AuthResponse>('/auth/mfa/verify', {
    body: { challengeToken, code },
  });
}

export function setupMfa(enrollmentToken?: string) {
  return apiRequest<{ secret: string; otpauthUri: string; status: string; enrollmentToken?: string }>(
    '/auth/mfa/setup',
    { body: enrollmentToken ? { enrollmentToken } : {} },
  );
}

export function enableMfa(code: string, enrollmentToken?: string) {
  return apiRequest<AuthResponse>('/auth/mfa/enable', {
    body: { code, enrollmentToken: enrollmentToken ?? null },
  });
}

export function forgotPassword(email: string) {
  return apiRequest<{ message: string; devResetToken?: string }>('/auth/forgot-password', {
    body: { email },
  });
}

export function resetPassword(token: string, newPassword: string) {
  return apiRequest<void>('/auth/reset-password', { body: { token, newPassword } });
}

export function acceptInvite(token: string, password: string) {
  return apiRequest<LoginResponse>('/auth/accept-invite', { body: { token, password } });
}

export function logout(refreshToken: string | null) {
  return apiRequest<void>('/auth/logout', { body: { refreshToken } });
}

// ---------------------------------------------------------------- profile

export function fetchMe() {
  return apiRequest<MeResponse>('/me');
}

export function fetchStatus() {
  return apiRequest<{
    status: string;
    restricted: boolean;
    reviewNote?: string;
    submittedAt?: string;
    profileCompletion?: Completion;
  }>('/me/status');
}

export function fetchProfile() {
  return apiRequest<{
    user: UserSummary;
    profile?: ResearcherProfile;
    businessId?: string;
    message?: string;
    completion: Completion;
  }>('/me/profile');
}

export function updateResearcherProfile(payload: {
  fullName?: string;
  organization?: string;
  designation?: string;
  phone?: string;
  purposeOfResearch?: string;
}) {
  return apiRequest<{ profile: ResearcherProfile; completion: Completion }>('/me/profile', {
    method: 'PATCH',
    body: payload,
  });
}

export function submitForReview() {
  return apiRequest<{ status: string; message: string; completion: Completion }>(
    '/me/submit-for-review',
    { method: 'POST', body: {} },
  );
}

// ---------------------------------------------------------------- business

export function fetchMyBusiness() {
  return apiRequest<BusinessRecord>('/my/business');
}

export function updateMyBusiness(payload: Record<string, unknown>) {
  return apiRequest<BusinessRecord>('/my/business', { method: 'PATCH', body: payload });
}

export function fetchBusiness(id: string) {
  return apiRequest<BusinessRecord>(`/businesses/${encodeURIComponent(id)}`);
}

export function searchBusinesses(params: {
  q?: string;
  industry?: string;
  city?: string;
  page?: number;
  size?: number;
}) {
  return apiRequest<PageResult<BusinessRecord>>(`/businesses${buildQuery(params)}`);
}

// ---------------------------------------------------------------- documents

export function fetchMyDocuments() {
  return apiRequest<DocumentSummary[]>('/my/documents');
}

export function fetchBusinessDocuments(businessId: string) {
  return apiRequest<DocumentSummary[]>(
    `/audit/businesses/${encodeURIComponent(businessId)}/documents`,
  );
}

export function uploadDocument(input: { uri: string; name: string; mimeType?: string; file?: File }, docType: string) {
  const form = new FormData();
  if (input.file) {
    form.append('file', input.file, input.name);
  } else {
    form.append('file', {
      uri: input.uri,
      name: input.name,
      type: input.mimeType ?? 'application/octet-stream',
    } as unknown as Blob);
  }
  form.append('docType', docType);
  return apiRequest<DocumentSummary>('/my/documents', { body: form });
}

export async function downloadDocument(id: string): Promise<Blob> {
  return apiBlob(`/documents/${encodeURIComponent(id)}/content`);
}

// ---------------------------------------------------------------- subscriptions

export function fetchPublicPlans(audience: 'researcher' | 'business') {
  return apiRequest<Plan[]>(`/public/plans${buildQuery({ audience })}`);
}

export function fetchResearcherPlans() {
  return apiRequest<Plan[]>('/plans');
}

export function fetchListingPlans() {
  return apiRequest<Plan[]>('/listing-plans');
}

export function subscribe(planCode: string) {
  return apiRequest<MySubscription>('/subscriptions', { body: { planCode } });
}

export function fetchMySubscription() {
  return apiRequest<MySubscription>('/subscriptions/me');
}

export function fetchLedger(page = 0, size = 20) {
  return apiRequest<PageResult<LedgerEntry>>(`/credits/ledger${buildQuery({ page, size })}`);
}

export function unlockBusiness(id: string) {
  return apiRequest<{ businessId: string; creditsRemaining: number; alreadyUnlocked?: boolean }>(
    `/businesses/${encodeURIComponent(id)}/unlock`,
    { method: 'POST', body: {} },
  );
}

export function fetchUnlockedBusinesses() {
  return apiRequest<UnlockedBusiness[]>('/businesses/unlocked');
}

// ---------------------------------------------------------------- saved searches

export function fetchSavedSearches() {
  return apiRequest<SavedSearch[]>('/saved-searches');
}

export function createSavedSearch(name: string, query: Record<string, unknown>) {
  return apiRequest<SavedSearch>('/saved-searches', { body: { name, query } });
}

export function deleteSavedSearch(id: string) {
  return apiRequest<{ deleted: boolean }>(`/saved-searches/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------- listings & payments

export function fetchMyListing() {
  return apiRequest<MyListing>('/my/listing');
}

export function purchaseListing(planCode: string) {
  return apiRequest<{
    listing: ListingSubscription;
    payment: Payment;
    message: string;
  }>('/my/listing', { body: { planCode } });
}

export function fetchMyPayments() {
  return apiRequest<Payment[]>('/my/payments');
}

// ---------------------------------------------------------------- auditor

export function fetchAuditorBusinesses(params: { q?: string; page?: number; size?: number }) {
  return apiRequest<PageResult<BusinessRecord>>(`/audit/businesses${buildQuery(params)}`);
}

export function addAuditorNote(businessId: string, note: string) {
  return apiRequest<{ business_id: string; note: string }>(
    `/audit/businesses/${encodeURIComponent(businessId)}/notes`,
    { body: { note } },
  );
}

// ---------------------------------------------------------------- admin: users

export function fetchAdminUsers(params: {
  role?: string;
  status?: string;
  q?: string;
  page?: number;
  size?: number;
}) {
  return apiRequest<PageResult<AdminUser>>(`/admin/users${buildQuery(params)}`);
}

export function fetchAdminUser(id: string) {
  return apiRequest<AdminUser>(`/admin/users/${encodeURIComponent(id)}`);
}

export function updateAdminUser(
  id: string,
  payload: { fullName?: string; email?: string; role?: string; status?: string; reviewNote?: string },
) {
  return apiRequest<AdminUser>(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function approveUser(id: string) {
  return apiRequest<AdminUser>(`/admin/users/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: {},
  });
}

export function rejectUser(id: string, reason: string) {
  return apiRequest<AdminUser>(`/admin/users/${encodeURIComponent(id)}/reject`, {
    body: { reason },
  });
}

export function suspendUser(id: string) {
  return apiRequest<AdminUser>(`/admin/users/${encodeURIComponent(id)}/suspend`, {
    method: 'POST',
    body: {},
  });
}

export function activateUser(id: string) {
  return apiRequest<AdminUser>(`/admin/users/${encodeURIComponent(id)}/activate`, {
    method: 'POST',
    body: {},
  });
}

export function adminResetPassword(id: string) {
  return apiRequest<{ temporaryPassword?: string; message?: string }>(
    `/admin/users/${encodeURIComponent(id)}/reset-password`,
    { method: 'POST', body: {} },
  );
}

export function adminResetMfa(id: string) {
  return apiRequest<void>(`/admin/users/${encodeURIComponent(id)}/reset-mfa`, {
    method: 'POST',
    body: {},
  });
}

export function inviteUser(payload: { email: string; fullName: string; role: string }) {
  return apiRequest<{ message?: string; devInviteToken?: string }>('/admin/users/invite', {
    body: payload,
  });
}

// ---------------------------------------------------------------- admin: businesses

export function fetchAdminBusinesses(params: {
  q?: string;
  verificationStatus?: string;
  listingStatus?: string;
  page?: number;
  size?: number;
}) {
  return apiRequest<PageResult<BusinessRecord>>(`/admin/businesses${buildQuery(params)}`);
}

export function fetchAdminBusiness(id: string) {
  return apiRequest<BusinessRecord>(`/admin/businesses/${encodeURIComponent(id)}`);
}

export function updateAdminBusiness(id: string, payload: Record<string, unknown>) {
  return apiRequest<BusinessRecord>(`/admin/businesses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  });
}

// ---------------------------------------------------------------- admin: documents

export function fetchDocumentQueue(params: { status?: string; page?: number; size?: number }) {
  return apiRequest<{
    items: DocumentSummary[];
    page: number;
    size: number;
    total: number;
    totalPages: number;
  }>(`/admin/documents${buildQuery(params)}`);
}

export function approveDocument(id: string) {
  return apiRequest<DocumentSummary>(`/admin/documents/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: {},
  });
}

export function rejectDocument(id: string, reason: string) {
  return apiRequest<DocumentSummary>(`/admin/documents/${encodeURIComponent(id)}/reject`, {
    body: { reason },
  });
}

// ---------------------------------------------------------------- admin: plans

export function fetchAdminPlans() {
  return apiRequest<Plan[]>('/admin/plans');
}

export function createPlan(payload: Record<string, unknown>) {
  return apiRequest<Plan>('/admin/plans', { body: payload });
}

export function updatePlan(id: string, payload: Record<string, unknown>) {
  return apiRequest<Plan>(`/admin/plans/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  });
}

// ---------------------------------------------------------------- admin: subscriptions

export function fetchAdminSubscriptions(params: {
  userId?: string;
  page?: number;
  size?: number;
}) {
  return apiRequest<AdminSubscriptionList>(`/admin/subscriptions${buildQuery(params)}`);
}

export function adjustSubscriptionCredits(id: string, amount: number, reason?: string) {
  return apiRequest<Subscription>(`/admin/subscriptions/${encodeURIComponent(id)}/credits`, {
    body: { amount, reason },
  });
}

export function extendSubscription(id: string, months: number, reason?: string) {
  return apiRequest<Subscription>(`/admin/subscriptions/${encodeURIComponent(id)}/extend`, {
    body: { months, reason },
  });
}

export function cancelSubscription(id: string, reason?: string) {
  return apiRequest<Subscription>(`/admin/subscriptions/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: { reason },
  });
}

// ---------------------------------------------------------------- admin: listings

export function fetchAdminListings(params: { status?: string; page?: number; size?: number }) {
  return apiRequest<PageResult<ListingSubscription>>(`/admin/listings${buildQuery(params)}`);
}

export function adminListBusiness(id: string) {
  return apiRequest<unknown>(`/admin/businesses/${encodeURIComponent(id)}/listing/list`, {
    method: 'POST',
    body: {},
  });
}

export function adminUnlistBusiness(id: string) {
  return apiRequest<unknown>(`/admin/businesses/${encodeURIComponent(id)}/listing/unlist`, {
    method: 'POST',
    body: {},
  });
}

export function adminExtendListing(id: string, months: number, reason?: string) {
  return apiRequest<unknown>(`/admin/businesses/${encodeURIComponent(id)}/listing/extend`, {
    body: { months, reason },
  });
}

export function adminCancelListing(id: string, reason?: string) {
  return apiRequest<unknown>(`/admin/businesses/${encodeURIComponent(id)}/listing/cancel`, {
    method: 'POST',
    body: { reason },
  });
}

// ---------------------------------------------------------------- admin: payments

export function fetchAdminPayments(params: {
  status?: string;
  userId?: string;
  page?: number;
  size?: number;
}) {
  return apiRequest<PageResult<Payment>>(`/admin/payments${buildQuery(params)}`);
}

export function recordOfflinePayment(payload: {
  paymentId?: string;
  referenceId?: string;
  listingId?: string;
  purpose?: string;
  providerRef?: string;
}) {
  return apiRequest<Payment>('/admin/payments', { body: payload });
}

export function refundPayment(id: string, reason?: string) {
  return apiRequest<Payment>(`/admin/payments/${encodeURIComponent(id)}/refund`, {
    body: { reason },
  });
}

// ---------------------------------------------------------------- admin: policies

export function fetchPolicyFields() {
  return apiRequest<PolicyRow[]>('/admin/policies/fields');
}

export function updatePolicyFields(
  policies: { role: string; resource: string; field: string; access: string; unlockState?: string }[],
) {
  return apiRequest<PolicyRow[]>('/admin/policies/fields', {
    method: 'PUT',
    body: { policies },
  });
}

export function previewPolicy(params: {
  role: string;
  userId?: string;
  businessId?: string;
  state?: string;
}) {
  return apiRequest<{
    role: string;
    userId?: string;
    businessId?: string;
    state: string;
    fields: Record<string, string>;
  }>(`/admin/policies/preview${buildQuery(params)}`);
}

export function fetchUserOverrides(userId: string) {
  return apiRequest<PolicyOverride[]>(`/admin/policies/users/${encodeURIComponent(userId)}`);
}

export function updateUserOverrides(
  userId: string,
  overrides: {
    resource: string;
    field: string;
    access: string;
    unlockState?: string;
    expiresAt?: string | null;
  }[],
) {
  return apiRequest<PolicyOverride[]>(`/admin/policies/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: { overrides },
  });
}

export function deleteUserOverride(userId: string, overrideId: string) {
  return apiRequest<void>(
    `/admin/policies/users/${encodeURIComponent(userId)}/${encodeURIComponent(overrideId)}`,
    { method: 'DELETE' },
  );
}

// ---------------------------------------------------------------- admin: audit, dashboard, settings

export function fetchAuditLogs(params: {
  action?: string;
  resourceType?: string;
  actor?: string;
  resourceId?: string;
  page?: number;
  size?: number;
}) {
  return apiRequest<PageResult<AuditLogEntry>>(`/admin/audit-logs${buildQuery(params)}`);
}

export function exportAuditLogs(params: {
  action?: string;
  resourceType?: string;
  actor?: string;
  resourceId?: string;
}) {
  return apiBlob(`/admin/audit-logs/export${buildQuery(params)}`);
}

export function fetchAdminDashboard() {
  return apiRequest<AdminDashboard>('/admin/dashboard');
}

export function fetchSettings() {
  return apiRequest<SettingsMap>('/admin/settings');
}

export function updateSettings(values: Record<string, string>) {
  return apiRequest<SettingsMap>('/admin/settings', { method: 'PUT', body: values });
}

export function fetchProfileRequirements(role?: string) {
  return apiRequest<ProfileRequirement[]>(`/admin/profile-requirements${buildQuery({ role })}`);
}

export function updateProfileRequirements(
  requirements: { role: string; kind: string; name: string; required: boolean }[],
) {
  return apiRequest<ProfileRequirement[]>('/admin/profile-requirements', {
    method: 'PUT',
    body: { requirements },
  });
}

export function deleteProfileRequirement(id: string) {
  return apiRequest<void>(`/admin/profile-requirements/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
