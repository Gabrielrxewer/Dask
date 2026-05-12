import { describe, expect, it } from 'vitest';
import {
  createFiscalCompanyConfigDto,
  updateFiscalCompanyConfigDto
} from '@/modules/fiscal/http/dto';

const baseCompanyPayload = {
  displayName: 'Fiscal Ltda',
  legalName: 'Fiscal Ltda',
  cnpj: '12345678000190',
  focusToken: 'focus-token-value',
  focusEnvironment: 'homologacao'
};

describe('fiscal/http dto', () => {
  it('defaults new fiscal company configs to manual Stripe review', () => {
    const result = createFiscalCompanyConfigDto.parse(baseCompanyPayload);

    expect(result.stripePolicy).toBe('manual_review');
  });

  it('keeps partial fiscal company updates partial', () => {
    const result = updateFiscalCompanyConfigDto.parse({});

    expect(result).not.toHaveProperty('stripePolicy');
  });

  it('rejects legacy assisted Stripe policy on new writes', () => {
    expect(() =>
      createFiscalCompanyConfigDto.parse({
        ...baseCompanyPayload,
        stripePolicy: 'assisted_one_click'
      })
    ).toThrow();
  });
});
