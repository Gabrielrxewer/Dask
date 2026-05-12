import { describe, expect, it } from 'vitest';
import {
  createBillingPortalToken,
  hashBillingPortalToken,
  verifyBillingPortalToken
} from '@/modules/billing/domain/portal-token';

const SECRET = 'billing-portal-secret-for-tests';

describe('billing portal token', () => {
  it('creates a signed scoped token and verifies its claims', () => {
    const created = createBillingPortalToken({
      workspaceId: 'workspace-1',
      orderId: 'order-1',
      customerEmail: 'client@example.com',
      scopes: ['view', 'pay'],
      secret: SECRET
    });

    const claims = verifyBillingPortalToken(created.token, SECRET);

    expect(claims.workspaceId).toBe('workspace-1');
    expect(claims.orderId).toBe('order-1');
    expect(claims.customerEmail).toBe('client@example.com');
    expect(claims.scopes).toEqual(['view', 'pay']);
    expect(created.tokenHash).toBe(hashBillingPortalToken(created.token));
  });

  it('rejects tampered and expired tokens', () => {
    const created = createBillingPortalToken({
      workspaceId: 'workspace-1',
      orderId: 'order-1',
      expiresInSeconds: -1,
      secret: SECRET
    });
    const valid = createBillingPortalToken({
      workspaceId: 'workspace-1',
      orderId: 'order-1',
      secret: SECRET
    });

    expect(() => verifyBillingPortalToken(created.token, SECRET)).toThrow(/expired/i);
    expect(() => verifyBillingPortalToken(`${valid.token}tampered`, SECRET)).toThrow(/signature/i);
  });

  it('rejects malformed tokens and weak token secrets', () => {
    expect(() => verifyBillingPortalToken('not-a-signed-token', SECRET)).toThrow(/format/i);
    expect(() => createBillingPortalToken({
      workspaceId: 'workspace-1',
      orderId: 'order-1',
      secret: 'short'
    })).toThrow(/at least 16/i);
  });
});
