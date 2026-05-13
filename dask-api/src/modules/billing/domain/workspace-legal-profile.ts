export type WorkspaceBusinessType = 'individual' | 'company' | 'corporate';

export interface WorkspaceLegalProfile {
  tradeName: string | null;
  legalName: string | null;
  taxId: string | null;
  website: string | null;
  description: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  businessType: WorkspaceBusinessType;
  defaultNoticeDays: number | null;
  legalVenueCity: string | null;
  legalVenueState: string | null;
}

export interface WorkspaceLegalProfileSource {
  id: string;
  name: string;
  kind?: string | null;
  info?: Record<string, unknown> | null;
  companyProfile?: Record<string, unknown> | null;
}

export interface StripeConnectPrefillPayload {
  business_profile?: {
    name?: string;
    url?: string;
    product_description?: string;
  };
  business_type?: 'individual' | 'company';
  company?: {
    name?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
  metadata: {
    workspaceId: string;
    workspaceName: string;
  };
}

export function normalizeWorkspaceTaxId(value: string | null | undefined): string | null {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  return digits.length === 11 || digits.length === 14 ? digits : null;
}

export function isValidWorkspaceWebsite(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function optionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    return null;
  }
  return Math.max(0, Number.parseInt(value.trim(), 10));
}

function normalizeCountry(value: unknown): string {
  const country = optionalText(value)?.toUpperCase();
  return country && /^[A-Z]{2}$/.test(country) ? country : 'BR';
}

function normalizeBusinessType(value: unknown, taxId: string | null, kind?: string | null): WorkspaceBusinessType {
  if (value === 'individual' || value === 'company' || value === 'corporate') {
    return value;
  }
  if (taxId?.length === 11) {
    return 'individual';
  }
  if (kind === 'PERSONAL') {
    return 'individual';
  }
  return 'company';
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '')
  ) as Partial<T>;
}

export function buildWorkspaceLegalProfile(source: WorkspaceLegalProfileSource): WorkspaceLegalProfile {
  const companyProfile = source.companyProfile ?? {};
  const info = source.info ?? {};
  const taxId = normalizeWorkspaceTaxId(optionalText(companyProfile.document) ?? optionalText(companyProfile.taxId));
  const addressLine1 = optionalText(companyProfile.addressLine1) ?? optionalText(companyProfile.address);
  const businessType = normalizeBusinessType(companyProfile.businessType, taxId, source.kind);

  return {
    tradeName: optionalText(companyProfile.name) ?? optionalText(info.company) ?? source.name,
    legalName: optionalText(companyProfile.legalName),
    taxId,
    website: optionalText(info.website) ?? optionalText(companyProfile.website),
    description: optionalText(info.description) ?? optionalText(companyProfile.description),
    addressLine1,
    addressLine2: optionalText(companyProfile.addressLine2),
    city: optionalText(companyProfile.city),
    state: optionalText(companyProfile.state),
    postalCode: optionalText(companyProfile.postalCode)?.replace(/\D/g, '') ?? null,
    country: normalizeCountry(companyProfile.country),
    businessType,
    defaultNoticeDays: optionalNumber(companyProfile.noticePeriod ?? companyProfile.defaultNoticeDays),
    legalVenueCity: optionalText(companyProfile.jurisdictionCity) ?? optionalText(companyProfile.legalVenueCity),
    legalVenueState: optionalText(companyProfile.jurisdictionState) ?? optionalText(companyProfile.legalVenueState)
  };
}

export function buildStripeConnectPrefillPayload(input: {
  workspaceId: string;
  workspaceName: string;
  profile: WorkspaceLegalProfile;
  includeCompanyFields?: boolean;
}): StripeConnectPrefillPayload {
  const businessName = input.profile.tradeName ?? input.profile.legalName ?? input.workspaceName;
  const businessProfile = compactObject({
    name: businessName,
    url: isValidWorkspaceWebsite(input.profile.website) ? input.profile.website : undefined,
    product_description:
      input.profile.description ?? `Pagamentos recebidos por ${businessName} via Dask`
  });
  const stripeBusinessType = input.profile.businessType === 'individual' ? 'individual' : 'company';
  const companyAddress = compactObject({
    line1: input.profile.addressLine1 ?? undefined,
    line2: input.profile.addressLine2 ?? undefined,
    city: input.profile.city ?? undefined,
    state: input.profile.state ?? undefined,
    postal_code: input.profile.postalCode ?? undefined,
    country: input.profile.country
  });
  const company = input.includeCompanyFields && stripeBusinessType === 'company'
    ? compactObject({
        name: input.profile.legalName ?? input.profile.tradeName ?? undefined,
        address: Object.keys(companyAddress).length > 0 ? companyAddress : undefined
      })
    : {};

  return compactObject({
    business_profile: Object.keys(businessProfile).length > 0 ? businessProfile : undefined,
    business_type: stripeBusinessType,
    company: Object.keys(company).length > 0 ? company : undefined,
    metadata: {
      workspaceId: input.workspaceId,
      workspaceName: input.workspaceName
    }
  }) as StripeConnectPrefillPayload;
}
