export function titleCase(value?: string | null): string {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function humanizeField(field: string): string {
  return titleCase(field.replace(/_/g, ' '));
}

interface PlanTier {
  priceAmount: number;
  durationMonths: number;
  credits?: number | null;
}

/**
 * Mirrors the server rule: a successive plan is priced higher, then runs longer, then has more
 * credits. Only such a plan can be bought while the current subscription is still active.
 */
export function isPlanUpgrade(current: PlanTier, candidate: PlanTier): boolean {
  if (candidate.priceAmount !== current.priceAmount) {
    return candidate.priceAmount > current.priceAmount;
  }
  if (candidate.durationMonths !== current.durationMonths) {
    return candidate.durationMonths > current.durationMonths;
  }
  return (candidate.credits ?? 0) > (current.credits ?? 0);
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMoney(amount?: number | null, currency = 'INR'): string {
  if (amount === null || amount === undefined) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** Indian compact notation: ₹1.25 Cr / ₹45.00 L, falling back to plain money below a lakh. */
export function formatInrCompact(amount?: number | null): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const absolute = Math.abs(amount);
  if (absolute >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (absolute >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  return formatMoney(amount);
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function statusTone(status?: string | null): Tone {
  switch ((status ?? '').toLowerCase()) {
    case 'active':
    case 'listed':
    case 'paid':
    case 'approved':
    case 'verified':
    case 'authenticated':
      return 'success';
    case 'pending':
    case 'pending_payment':
    case 'pending_profile':
    case 'pending_review':
    case 'pending_email':
    case 'awaiting_plan':
    case 'expiring':
    case 'unverified':
      return 'warning';
    case 'suspended':
    case 'rejected':
    case 'failed':
    case 'expired':
    case 'cancelled':
    case 'unlisted_by_admin':
      return 'danger';
    case 'refunded':
    case 'not_approved':
    case 'unlisted':
      return 'info';
    default:
      return 'neutral';
  }
}

export function roleLabel(role?: string | null): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'auditor':
      return 'Auditor';
    case 'business':
      return 'Business';
    case 'researcher':
      return 'Researcher';
    default:
      return titleCase(role) || 'User';
  }
}

export const DOCUMENT_TYPES = [
  { value: 'ID_PROOF', label: 'ID proof' },
  { value: 'BUSINESS_LICENSE', label: 'Business licence' },
  { value: 'TAX_CERTIFICATE', label: 'Tax certificate' },
  { value: 'ADDRESS_PROOF', label: 'Address proof' },
  { value: 'OTHER', label: 'Other' },
];

export function documentTypeLabel(value?: string | null): string {
  if (!value) return 'Document';
  return DOCUMENT_TYPES.find((type) => type.value.toLowerCase() === value.toLowerCase())?.label
    ?? titleCase(value);
}

export interface FieldDef {
  key: string;
  label: string;
  multiline?: boolean;
  keyboard?: 'default' | 'numeric' | 'email-address' | 'phone-pad' | 'url';
  required?: boolean;
  placeholder?: string;
}

export const BUSINESS_FIELDS: FieldDef[] = [
  { key: 'legal_name', label: 'Legal name', required: true },
  { key: 'trade_name', label: 'Trade name' },
  { key: 'registration_number', label: 'Registration number', required: true },
  { key: 'tax_id', label: 'Tax ID', required: true },
  { key: 'industry', label: 'Industry', required: true },
  { key: 'category', label: 'Category', required: true },
  { key: 'address_line', label: 'Address line', required: true },
  { key: 'city', label: 'City', required: true },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country', required: true },
  { key: 'postal_code', label: 'Postal code' },
  { key: 'website', label: 'Website', keyboard: 'url', placeholder: 'https://example.com' },
  { key: 'public_email', label: 'Public email', keyboard: 'email-address', required: true },
  { key: 'public_phone', label: 'Public phone', keyboard: 'phone-pad', required: true },
  { key: 'contact_person_name', label: 'Contact person', required: true },
  { key: 'contact_person_phone', label: 'Contact phone', keyboard: 'phone-pad', required: true },
  { key: 'annual_revenue', label: 'Annual revenue', keyboard: 'numeric' },
  { key: 'employee_count', label: 'Employee count', keyboard: 'numeric' },
  { key: 'net_profit', label: 'Net profit (₹)', keyboard: 'numeric' },
  { key: 'net_worth', label: 'Net worth (₹)', keyboard: 'numeric' },
  {
    key: 'monthly_turnover',
    label: 'Monthly turnover (₹, oldest first)',
    multiline: true,
    placeholder: '450000, 470000, 460000 …',
  },
  { key: 'bank_details', label: 'Bank details', multiline: true },
  { key: 'description', label: 'Description', multiline: true, required: true },
  {
    key: 'profile_video_url',
    label: 'Corporate profile video URL',
    keyboard: 'url',
    placeholder: 'https://www.youtube.com/watch?v=… or an MP4 link',
  },
  {
    key: 'liabilities',
    label: 'Loans & liabilities',
    multiline: true,
    placeholder: 'Bank Term Loan | HDFC Bank | 3500000\nCash Credit / OD | State Bank of India | 1200000',
  },
  { key: 'ca_name', label: 'Certifying CA name', placeholder: 'CA Full Name' },
  { key: 'ca_membership_no', label: 'CA ICAI membership no.', placeholder: '6-digit membership number' },
  { key: 'ca_udin', label: 'CA UDIN (optional)', placeholder: '18-character UDIN' },
];

export const BUSINESS_DISPLAY_ORDER = [
  'legal_name',
  'trade_name',
  'registration_number',
  'tax_id',
  'industry',
  'category',
  'address_line',
  'city',
  'state',
  'country',
  'postal_code',
  'website',
  'public_email',
  'public_phone',
  'contact_person_name',
  'contact_person_phone',
  'annual_revenue',
  'employee_count',
  'net_profit',
  'net_worth',
  'monthly_turnover',
  'bank_details',
  'description',
  'profile_video_url',
  'liabilities',
  'ca_name',
  'ca_membership_no',
  'ca_udin',
  'verification_status',
  'admin_listing_status',
  'listing_status',
  'listed_until',
  'created_at',
  'updated_at',
];

export function displayValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key.endsWith('_at') || key === 'listed_until') return formatDateTime(String(value));
  if (key === 'annual_revenue' || key === 'net_profit' || key === 'net_worth') {
    return formatMoney(Number(value));
  }
  if (key === 'monthly_turnover' && Array.isArray(value)) {
    return value.length ? `${value.length} months` : '—';
  }
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : '—';
  if (typeof value === 'object') return '—';
  return String(value);
}
