import { describe, expect, it } from 'vitest';
import { generateOtp, hashOtp, verifyOtpHash } from './otp';

describe('OTP service', () => {
  it('generates 6 digit otp', () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('hashes and verifies otp', () => {
    const otp = '123456';
    const hash = hashOtp(otp);

    expect(hash).toBeTruthy();
    expect(verifyOtpHash('123456', hash)).toBe(true);
    expect(verifyOtpHash('654321', hash)).toBe(false);
  });
});
