import { describe, expect, it } from 'vitest';
import { listConnectCatalogItemsQueryDto, listConnectPaymentOrdersQueryDto } from '@/modules/billing/http/dto';
import { campaignListQueryDto, audienceQueryDto, signalInboxQueryDto } from '@/modules/marketing/http/dto';
import {
  fiscalCompaniesQueryDto,
  fiscalDocumentsQueryDto,
  fiscalDraftsQueryDto,
  fiscalSyncRunsQueryDto,
  receivedQueryDto
} from '@/modules/fiscal/http/dto';
import { workItemListQueryDto } from '@/modules/workspace-platform/http/dto';

const cursor = '11111111-1111-4111-8111-111111111111';

describe('wide pagination contracts', () => {
  it('accepts the maximum stable List page and rejects oversized pages', () => {
    expect(
      workItemListQueryDto.parse({
        paged: 'true',
        page: '8',
        pageSize: '200',
        cursor,
        search: '  enterprise  ',
        sortBy: 'updatedAt',
        sortDirection: 'desc'
      })
    ).toMatchObject({
      paged: true,
      page: 8,
      pageSize: 200,
      cursor,
      search: 'enterprise',
      sortBy: 'updatedAt',
      sortDirection: 'desc'
    });

    expect(() => workItemListQueryDto.parse({ pageSize: '201' })).toThrow();
  });

  it('accepts wide Agenda schedule windows without changing cursor semantics', () => {
    expect(
      workItemListQueryDto.parse({
        pageSize: '200',
        cursor,
        plannedWindowFrom: '2026-05-04T00:00:00.000Z',
        plannedWindowTo: '2026-05-18T00:00:00.000Z',
        sortBy: 'plannedStartAt',
        sortDirection: 'asc'
      })
    ).toMatchObject({
      pageSize: 200,
      cursor,
      plannedWindowFrom: new Date('2026-05-04T00:00:00.000Z'),
      plannedWindowTo: new Date('2026-05-18T00:00:00.000Z'),
      sortBy: 'plannedStartAt',
      sortDirection: 'asc'
    });
  });

  it('keeps Marketing limits explicit for campaigns, audience and signals', () => {
    expect(campaignListQueryDto.parse({ limit: '200', search: '  nurture  ' })).toMatchObject({
      limit: 200,
      search: 'nurture'
    });
    expect(audienceQueryDto.parse({ limit: '400', consentStatus: 'OPT_IN' })).toMatchObject({
      limit: 400,
      consentStatus: 'OPT_IN'
    });
    expect(signalInboxQueryDto.parse({ limit: '200', includeDismissed: 'true' })).toMatchObject({
      limit: 200,
      includeDismissed: 'true'
    });

    expect(() => campaignListQueryDto.parse({ limit: '201' })).toThrow();
    expect(() => audienceQueryDto.parse({ limit: '401' })).toThrow();
    expect(() => signalInboxQueryDto.parse({ limit: '201' })).toThrow();
  });

  it('keeps Billing catalog and history cursor pages bounded', () => {
    expect(listConnectCatalogItemsQueryDto.parse({ pageSize: '200', cursor, includeInactive: 'false' })).toMatchObject({
      pageSize: 200,
      cursor,
      includeInactive: false
    });
    expect(listConnectPaymentOrdersQueryDto.parse({ pageSize: '200', cursor, status: 'PAID' })).toMatchObject({
      pageSize: 200,
      cursor,
      status: 'PAID'
    });

    expect(() => listConnectCatalogItemsQueryDto.parse({ pageSize: '201' })).toThrow();
    expect(() => listConnectPaymentOrdersQueryDto.parse({ pageSize: '201' })).toThrow();
  });

  it('keeps every Fiscal operational list on the same bounded cursor contract', () => {
    const inputs = [
      fiscalDocumentsQueryDto.parse({ pageSize: '200', cursor, direction: 'OUTBOUND' }),
      receivedQueryDto.parse({ pageSize: '200', cursor, type: 'NFE_MDE' }),
      fiscalCompaniesQueryDto.parse({ pageSize: '200', cursor, search: '  matriz  ' }),
      fiscalDraftsQueryDto.parse({ pageSize: '200', cursor }),
      fiscalSyncRunsQueryDto.parse({ pageSize: '200', cursor })
    ];

    expect(inputs).toEqual([
      expect.objectContaining({ pageSize: 200, cursor, direction: 'OUTBOUND' }),
      expect.objectContaining({ pageSize: 200, cursor, type: 'NFE_MDE' }),
      expect.objectContaining({ pageSize: 200, cursor, search: 'matriz' }),
      expect.objectContaining({ pageSize: 200, cursor }),
      expect.objectContaining({ pageSize: 200, cursor })
    ]);

    expect(() => fiscalDocumentsQueryDto.parse({ pageSize: '201' })).toThrow();
    expect(() => receivedQueryDto.parse({ pageSize: '201' })).toThrow();
    expect(() => fiscalCompaniesQueryDto.parse({ pageSize: '201' })).toThrow();
    expect(() => fiscalDraftsQueryDto.parse({ pageSize: '201' })).toThrow();
    expect(() => fiscalSyncRunsQueryDto.parse({ pageSize: '201' })).toThrow();
  });
});
