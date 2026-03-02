import { z } from 'zod';

const phoneRegex = /^\+374\d{8}$/;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const registerPhoneSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Invalid phone format'),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  passportNumber: z.string().trim().min(2),
  passportType: z.enum(['PASSPORT', 'ID_CARD']).default('PASSPORT'),
  passportIssueDate: z.string().regex(isoDateRegex, 'Invalid date format').optional(),
  passportValidTill: z.string().regex(isoDateRegex, 'Invalid date format').optional(),
});

export const verifyPhoneOtpSchema = z.object({
  sessionId: z.string().uuid(),
  phone: z.string().regex(phoneRegex),
  otp: z.string().regex(/^\d{6}$/),
});

export const requestEmailOtpSchema = z.object({
  sessionId: z.string().uuid(),
  email: z.string().email(),
});

export const verifyEmailOtpSchema = z.object({
  sessionId: z.string().uuid(),
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
});

export const completeRegistrationSchema = z.object({
  sessionId: z.string().uuid(),
  password: z
    .string()
    .min(8)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/\d/)
    .regex(/[^A-Za-z0-9]/),
  pin: z.string().regex(/^\d{4}$/),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/).optional(),
});

export const validateBody = <T>(schema: z.Schema<T>, body: unknown): T => {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(', ');
    const error: any = new Error(message || 'Validation failed');
    error.status = 400;
    throw error;
  }

  return parsed.data;
};
