import { z } from 'zod';

const phoneRegex = /^\+374\d{8}$/;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const normalizePhoneInput = (value: unknown) => {
  const raw = String(value ?? '').trim();
  const compact = raw.replace(/\s+/g, '');

  if (compact.startsWith('374') && !compact.startsWith('+')) {
    return `+${compact}`;
  }

  return compact;
};

const optionalIsoDateSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    const text = String(value).trim();
    return text.length ? text : undefined;
  },
  z.string().regex(isoDateRegex, 'Invalid date format').optional(),
);

export const registerPhoneSchema = z.object({
  phone: z.preprocess(
    normalizePhoneInput,
    z.string().regex(phoneRegex, 'Invalid phone format'),
  ),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  passportNumber: z.string().trim().min(2),
  passportType: z.enum(['PASSPORT', 'ID_CARD']).default('PASSPORT'),
  passportIssueDate: optionalIsoDateSchema,
  passportValidTill: optionalIsoDateSchema,
});

export const verifyPhoneOtpSchema = z.object({
  sessionId: z.string().uuid(),
  phone: z.preprocess(normalizePhoneInput, z.string().regex(phoneRegex)),
  otp: z.string().regex(/^\d{4,8}$/),
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

export const loginCredentialsSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(1),
});

export const loginPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
});

export const validateBody = <S extends z.ZodTypeAny>(
  schema: S,
  body: unknown,
): z.infer<S> => {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(', ');
    const error: any = new Error(message || 'Validation failed');
    error.status = 400;
    throw error;
  }

  return parsed.data;
};
