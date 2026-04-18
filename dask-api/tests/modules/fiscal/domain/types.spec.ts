import { describe, expect, it } from 'vitest';
import { mapFocusStatusToInternal, sanitizeDocumentReference } from '@/modules/fiscal/domain/types';

describe('fiscal domain types', () => {
  describe('mapFocusStatusToInternal', () => {
    it('maps authorized-like statuses to AUTHORIZED', () => {
      const result = mapFocusStatusToInternal('autorizado');
      expect(result.status).toBe('AUTHORIZED');
      expect(result.issueStatus).toBe('AUTHORIZED');
    });

    it('maps cancellation statuses to CANCELLED', () => {
      const result = mapFocusStatusToInternal('cancelada');
      expect(result.status).toBe('CANCELLED');
      expect(result.issueStatus).toBe('CANCELLED');
    });

    it('maps rejection/error statuses to REJECTED', () => {
      const result = mapFocusStatusToInternal('erro de validacao');
      expect(result.status).toBe('REJECTED');
      expect(result.issueStatus).toBe('REJECTED');
    });

    it('falls back to PROCESSING for unknown statuses', () => {
      const result = mapFocusStatusToInternal('status-inesperado');
      expect(result.status).toBe('PROCESSING');
      expect(result.issueStatus).toBe('PROCESSING');
    });
  });

  describe('sanitizeDocumentReference', () => {
    it('normalizes and strips unsafe chars', () => {
      const value = sanitizeDocumentReference('  Pedido #123 / Teste  ');
      expect(value).toBe('pedido-123-teste');
    });
  });
});

