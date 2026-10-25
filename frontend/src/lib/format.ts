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
  { key: 'bank_details', label: 'Bank details', multiline: true },
  { key: 'description', label: 'Description', multiline: true, required: true },
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
  'bank_details',
  'description',
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
  if (key === 'annual_revenue') return formatMoney(Number(value));
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : '—';
  if (typeof value === 'object') return '—';
  return String(value);
}
