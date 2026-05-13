import { describe, expect, it } from 'vitest';
import {
  buildStripeConnectPrefillPayload,
  buildWorkspaceLegalProfile,
  normalizeWorkspaceTaxId
} from '@/modules/billing/domain/workspace-legal-profile';

describe('workspace legal profile Stripe prefill', () => {
  it('maps workspace legal profile into Stripe Connect prefill fields', () => {
    const profile = buildWorkspaceLegalProfile({
      id: 'workspace-1',
      name: 'Dask Workspace',
      kind: 'CORPORATE',
      info: {
        website: 'https://dask.example',
        description: 'Servicos de implantacao e suporte.'
      },
      companyProfile: {
        name: 'Dask Labs',
        legalName: 'Dask Labs Tecnologia Ltda',
        document: '12.345.678/0001-90',
        addressLine1: 'Av Paulista, 1000',
        addressLine2: 'Cj 12',
        city: 'Sao Paulo',
        state: 'SP',
        postalCode: '01310-100',
        country: 'br',
        businessType: 'company'
      }
    });

    expect(profile.taxId).toBe('12345678000190');

    expect(buildStripeConnectPrefillPayload({
      workspaceId: 'workspace-1',
      workspaceName: 'Dask Workspace',
      profile,
      includeCompanyFields: true
    })).toEqual({
      business_profile: {
        name: 'Dask Labs',
        url: 'https://dask.example',
        product_description: 'Servicos de implantacao e suporte.'
      },
      business_type: 'company',
      company: {
        name: 'Dask Labs Tecnologia Ltda',
        address: {
          line1: 'Av Paulista, 1000',
          line2: 'Cj 12',
          city: 'Sao Paulo',
          state: 'SP',
          postal_code: '01310100',
          country: 'BR'
        }
      },
      metadata: {
        workspaceId: 'workspace-1',
        workspaceName: 'Dask Workspace'
      }
    });
  });

  it('does not send empty fields or invalid website values to Stripe', () => {
    const profile = buildWorkspaceLegalProfile({
      id: 'workspace-1',
      name: 'Workspace Test',
      kind: 'CORPORATE',
      info: { website: 'site-invalido' },
      companyProfile: { document: '' }
    });

    expect(profile.taxId).toBeNull();
    expect(buildStripeConnectPrefillPayload({
      workspaceId: 'workspace-1',
      workspaceName: 'Workspace Test',
      profile,
      includeCompanyFields: false
    })).toEqual({
      business_profile: {
        name: 'Workspace Test',
        product_description: 'Pagamentos recebidos por Workspace Test via Dask'
      },
      business_type: 'company',
      metadata: {
        workspaceId: 'workspace-1',
        workspaceName: 'Workspace Test'
      }
    });
  });

  it('normalizes only valid CPF or CNPJ lengths', () => {
    expect(normalizeWorkspaceTaxId('123.456.789-09')).toBe('12345678909');
    expect(normalizeWorkspaceTaxId('12.345.678/0001-90')).toBe('12345678000190');
    expect(normalizeWorkspaceTaxId('123')).toBeNull();
    expect(normalizeWorkspaceTaxId(undefined)).toBeNull();
  });
});
