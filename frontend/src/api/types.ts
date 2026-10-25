export type UserRole = 'researcher' | 'business' | 'auditor' | 'admin';

export type UserStatus =
  | 'pending_email'
  | 'pending_profile'
  | 'pending_review'
  | 'active'
  | 'rejected'
  | 'suspended';

export type Access = 'hidden' | 'masked' | 'read' | 'write';

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  restricted: boolean;
  mfaEnabled: boolean;
  emailVerified: boolean;
}

export interface AuthResponse {
  status: 'authenticated';
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  restricted: boolean;
  user: UserSummary;
}

export interface LoginMfaRequired {
  status: 'mfa_required';
  restricted: boolean;
  user: UserSummary;
  challengeToken: string;
}

export interface LoginMfaSetupRequired {
  status: 'mfa_setup_required';
  restricted: boolean;
  user: UserSummary;
  enrollmentToken: string;
}

export type LoginResponse = AuthResponse | LoginMfaRequired | LoginMfaSetupRequired;

export type FieldPolicies = Record<string, Access>;

export type FieldPolicyMap = {
  any?: FieldPolicies;
  locked?: FieldPolicies;
  unlocked?: FieldPolicies;
};

export interface MeResponse {
  user: UserSummary;
  permissions: string[];
  restricted: boolean;
  fieldPolicies: FieldPolicyMap;
  businessId?: string;
  profileCompletion?: Completion;
}

export interface Completion {
  percent: number;
  required: number;
  present: number;
  missing: { kind: 'field' | 'document'; name: string }[];
  complete: boolean;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  audience: 'researcher' | 'business';
  credits: number;
  durationMonths: number;
  priceAmount: number;
  currency: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  plan?: Plan;
  status: string;
  startsAt: string;
  endsAt: string;
  creditsGranted: number;
  creditsRemaining: number;
  active: boolean;
  cancelledAt?: string;
  createdAt: string;
}

export interface MySubscription {
  active: boolean;
  creditsRemaining: number;
  creditsGranted: number;
  unlockedCount: number;
  subscription: Subscription | null;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  subscriptionId: string;
  entryType: 'grant' | 'spend' | 'adjustment' | 'expire' | string;
  amount: number;
  businessId?: string;
  balanceAfter: number;
  reason?: string;
  createdBy?: string;
  createdAt: string;
}

export interface UnlockedBusiness {
  id?: string;
  businessId: string;
  legalName?: string;
  industry?: string;
  city?: string;
  country?: string;
  unlockedAt: string;
  [key: string]: unknown;
}

export interface Payment {
  id: string;
  userId?: string;
  purpose: 'listing' | 'subscription' | string;
  referenceId: string;
  amount: number;
  currency: string;
  provider: string;
  providerRef?: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | string;
  recordedBy?: string;
  createdAt: string;
  paidAt?: string;
}

export interface ListingSubscription {
  id: string;
  businessId: string;
  purchasedBy: string;
  planId: string;
  status: 'pending_payment' | 'active' | 'expired' | 'cancelled' | string;
  startsAt?: string;
  endsAt?: string;
  amount: number;
  currency: string;
  paymentId?: string;
  createdAt: string;
}

export interface MyListing {
  businessId: string;
  listingStatus: string;
  listedUntil?: string;
  adminListingStatus: string;
  history: ListingSubscription[];
  payments: Payment[];
}

export interface DocumentSummary {
  id: string;
  ownerUserId?: string;
  businessId?: string;
  docType: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: Record<string, unknown>;
  createdAt: string;
}

export type BusinessRecord = {
  id: string;
  legal_name?: string;
  trade_name?: string;
  registration_number?: string;
  tax_id?: string;
  industry?: string;
  category?: string;
  address_line?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  website?: string;
  public_email?: string;
  public_phone?: string;
  contact_person_name?: string;
  contact_person_phone?: string;
  annual_revenue?: number;
  employee_count?: number;
  bank_details?: string;
  description?: string;
  verification_status?: string;
  listed_until?: string;
  admin_listing_status?: string;
  listing_status?: string;
  owner_user_id?: string;
  created_at?: string;
  updated_at?: string;
  documents?: DocumentSummary[];
  owner?: { id: string; email: string; fullName: string; status: string };
  profile_completion?: Completion;
  [key: string]: unknown;
};

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  reviewNote?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
  businessName?: string;
  organization?: string;
  researcherProfile?: {
    organization?: string;
    designation?: string;
    phone?: string;
    purposeOfResearch?: string;
  };
  business?: Record<string, unknown>;
  documents?: DocumentSummary[];
}

export interface AuditLogEntry {
  id: string;
  actorUserId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface PolicyRow {
  id?: string;
  role: string;
  resource: string;
  field: string;
  access: Access;
  unlockState: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PolicyOverride {
  id: string;
  userId: string;
  resource: string;
  field: string;
  access: Access;
  unlockState: string;
  expiresAt?: string;
  updatedAt: string;
}

export interface AdminDashboard {
  pendingUsers: number;
  pendingDocuments: number;
  activeUsersByRole: Record<string, number>;
  totalUsers: number;
  activeSubscriptions: number;
  listedBusinesses: number;
  unlistedBusinesses: number;
  listingsExpiringIn30Days: number;
  creditsSpentThisMonth: number;
  recentAuditEvents: AuditLogEntry[];
}

export interface AdminSubscriptionList {
  items: Subscription[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface SettingsMap {
  [key: string]: string;
}

export interface ProfileRequirement {
  id: string;
  role: string;
  kind: 'field' | 'document';
  name: string;
  required: boolean;
}

export interface ResearcherProfile {
  userId: string;
  fullName?: string;
  organization?: string;
  designation?: string;
  phone?: string;
  purposeOfResearch?: string;
}
