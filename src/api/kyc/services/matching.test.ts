import { describe, expect, it } from 'vitest';
import { findMatchingPassport, isDocumentExpired, normalizeName } from './matching';

describe('KYC matching service', () => {
  it('normalizes names', () => {
    expect(normalizeName('  Gevorg  ')).toBe('gevorg');
    expect(normalizeName('GEVORG')).toBe('gevorg');
  });

  it('finds passport by number + normalized names', () => {
    const profile = {
      passportNumber: 'AB123456',
      firstName: 'Gevorg',
      lastName: 'Vorgyan',
    };

    const match = findMatchingPassport(profile, [
      { number: 'XX999999', name: 'Foo', surname: 'Bar' },
      { number: 'AB123456', name: '  GEVORG ', surname: 'vorgyan', validTill: '2030-01-01' },
    ]);

    expect(match).toBeTruthy();
    expect(match?.number).toBe('AB123456');
  });

  it('detects expired documents', () => {
    expect(isDocumentExpired('2001-01-01')).toBe(true);
    expect(isDocumentExpired('2999-01-01')).toBe(false);
  });
});
