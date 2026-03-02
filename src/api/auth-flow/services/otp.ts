import crypto from 'crypto';

const OTP_DIGITS = 6;

export const generateOtp = () => {
  const min = 10 ** (OTP_DIGITS - 1);
  const max = 10 ** OTP_DIGITS - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
};

export const hashOtp = (otp: string) => {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || 'change-me';
  return crypto.createHmac('sha256', secret).update(otp).digest('hex');
};

export const verifyOtpHash = (otp: string, hash: string) => {
  const candidate = hashOtp(otp);
  const left = Buffer.from(candidate, 'utf-8');
  const right = Buffer.from(hash, 'utf-8');

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
};

export const getOtpConfig = () => ({
  ttlSeconds: Number(process.env.OTP_TTL_SECONDS || 180),
  resendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 30),
  maxResendPerChannel: Number(process.env.OTP_MAX_RESEND_PER_CHANNEL || 5),
  maxVerifyAttempts: Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5),
});
