import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { assertRateLimit } from './rate-limit';
import {
  completeRegistrationSchema,
  loginSchema,
  registerPhoneSchema,
  requestEmailOtpSchema,
  validateBody,
  verifyEmailOtpSchema,
  verifyPhoneOtpSchema,
} from './validation';
import { generateOtp, getOtpConfig, hashOtp, verifyOtpHash } from './otp';

const OTP_UID = 'api::otp-code.otp-code';
const REG_UID = 'api::registration-session.registration-session';
const PROFILE_UID = 'api::customer-profile.customer-profile';

const REGISTRATION_SESSION_TTL_MINUTES = Number(process.env.REGISTRATION_SESSION_TTL_MINUTES || 30);
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_RATE_WINDOW_MS || 60_000);
const LOGIN_MAX_PER_WINDOW = Number(process.env.LOGIN_RATE_MAX_PER_WINDOW || 10);
const entityService: any = new Proxy(
  {},
  {
    get(_target, property) {
      return (strapi as any).entityService[property as keyof typeof strapi.entityService];
    },
  },
);

const toDate = (date: Date) => date.toISOString();

const isExpired = (dateValue: string | Date | null | undefined) => {
  if (!dateValue) {
    return true;
  }

  return new Date(dateValue).getTime() < Date.now();
};

const normalizeIdentifier = (value: string) => value.trim().toLowerCase();

const isEmailIdentifier = (value: string) => value.includes('@');

const getRequestMeta = (ctx) => ({
  ip: ctx.request.ip,
  userAgent: String(ctx.request.header['user-agent'] || ''),
});

const hashSensitive = (value: string) => {
  const secret = process.env.SENSITIVE_HASH_SECRET || process.env.JWT_SECRET || 'change-me';
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
};

const requestPhoneOtpFromProvider = async (phone: string) => {
  const providerUrl = process.env.SMS_PROVIDER_URL;
  const apiKey = process.env.SMS_PROVIDER_API_KEY;
  const apiSecret = process.env.SMS_PROVIDER_API_SECRET;
  const allowLocalFallback = process.env.ALLOW_LOCAL_PHONE_OTP_FALLBACK === 'true';

  if (!providerUrl) {
    if (!allowLocalFallback) {
      const error: any = new Error('Phone OTP provider is not configured');
      error.status = 500;
      throw error;
    }

    const fallbackOtp = generateOtp();
    strapi.log.warn(`SMS provider not configured. Local OTP fallback is used for ${phone}`);
    return { otp: fallbackOtp, providerRequestId: null };
  }

  const response = await fetch(providerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone,
      apiKey,
      apiSecret,
    }),
  });

  if (!response.ok) {
    const error: any = new Error('Phone OTP provider request failed');
    error.status = 502;
    throw error;
  }

  const data: any = await response.json();
  const otp = String(data?.otp || data?.code || '').trim();

  if (!/^\d{4,8}$/.test(otp)) {
    const error: any = new Error('Phone OTP provider returned invalid OTP payload');
    error.status = 502;
    throw error;
  }

  return {
    otp,
    providerRequestId: data?.requestId || data?.providerRequestId || null,
  };
};

const sendEmailOtp = async (email: string, otp: string) => {
  await strapi.plugin('email').service('email').send({
    to: email,
    subject: 'Your OTP code',
    text: `Your OTP is ${otp}`,
  });
};

const getRegistrationSession = async (sessionId: string) => {
  const rows = await entityService.findMany(REG_UID, {
    filters: { sessionId },
    limit: 1,
  });

  return (Array.isArray(rows) ? rows[0] : rows) || null;
};

const getOtp = async (sessionId: string, channel: 'PHONE' | 'EMAIL', purpose: 'REGISTER_PHONE' | 'REGISTER_EMAIL', target: string) => {
  const rows = await entityService.findMany(OTP_UID, {
    filters: {
      sessionId,
      channel,
      purpose,
      target,
      consumedAt: { $null: true },
    },
    sort: { createdAt: 'desc' },
    limit: 1,
  });

  return (Array.isArray(rows) ? rows[0] : rows) || null;
};

const ensureUniquePhone = async (phone: string) => {
  const existing = await entityService.findMany(PROFILE_UID, {
    filters: { phone },
    limit: 1,
  });

  if ((Array.isArray(existing) ? existing : [existing]).filter(Boolean).length) {
    const error: any = new Error('Unable to process registration');
    error.status = 409;
    throw error;
  }
};

const ensureUniqueEmail = async (email: string) => {
  const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { email: normalizeIdentifier(email) },
  });

  if (existingUser) {
    const error: any = new Error('Unable to process registration');
    error.status = 409;
    throw error;
  }
};

const upsertOtp = async ({
  sessionId,
  channel,
  purpose,
  target,
  otp,
  ip,
  userAgent,
}) => {
  const config = getOtpConfig();
  const now = new Date();
  const current = await getOtp(sessionId, channel, purpose, target);

  if (current?.lastSentAt) {
    const lastSentTs = new Date(current.lastSentAt).getTime();
    const cooldownMs = config.resendCooldownSeconds * 1000;

    if (Date.now() - lastSentTs < cooldownMs) {
      const error: any = new Error('Please wait before requesting OTP again');
      error.status = 429;
      throw error;
    }

    if ((current.resendCount || 0) >= config.maxResendPerChannel) {
      const error: any = new Error('Maximum resend attempts reached');
      error.status = 429;
      throw error;
    }
  }

  const payload = {
    channel,
    purpose,
    target,
    sessionId,
    codeHash: hashOtp(otp),
    expiresAt: toDate(new Date(Date.now() + config.ttlSeconds * 1000)),
    attempts: 0,
    resendCount: current ? (current.resendCount || 0) + 1 : 0,
    lastSentAt: now,
    ip,
    userAgent,
    consumedAt: null,
  };

  if (!current) {
    return entityService.create(OTP_UID, { data: payload });
  }

  return entityService.update(OTP_UID, current.id, { data: payload });
};

const verifyOtp = async ({
  sessionId,
  channel,
  purpose,
  target,
  otp,
}) => {
  const config = getOtpConfig();
  const row = await getOtp(sessionId, channel, purpose, target);

  if (!row || isExpired(row.expiresAt)) {
    const error: any = new Error('Invalid or expired OTP');
    error.status = 400;
    throw error;
  }

  if ((row.attempts || 0) >= config.maxVerifyAttempts) {
    const error: any = new Error('OTP verification attempts exceeded');
    error.status = 400;
    throw error;
  }

  const matched = verifyOtpHash(otp, row.codeHash);

  if (!matched) {
    await entityService.update(OTP_UID, row.id, {
      data: {
        attempts: (row.attempts || 0) + 1,
      },
    });

    const error: any = new Error('Invalid or expired OTP');
    error.status = 400;
    throw error;
  }

  await entityService.update(OTP_UID, row.id, {
    data: { consumedAt: new Date() },
  });
};

module.exports = {
  async requestPhoneOtp(ctx) {
    assertRateLimit(`otp:phone:${ctx.request.ip}`, 20, 60_000);

    const body = validateBody(registerPhoneSchema, ctx.request.body || {});
    await ensureUniquePhone(body.phone);

    const existingSessionRows = await entityService.findMany(REG_UID, {
      filters: {
        phone: body.phone,
        state: { $in: ['STARTED', 'PHONE_VERIFIED', 'EMAIL_VERIFIED'] },
      },
      sort: { createdAt: 'desc' },
      limit: 1,
    });

    const existingSession = Array.isArray(existingSessionRows) ? existingSessionRows : [existingSessionRows];
    const sessionId = existingSession[0]?.sessionId || randomUUID();
    const expiresAt = new Date(Date.now() + REGISTRATION_SESSION_TTL_MINUTES * 60 * 1000);

    if (existingSession[0]) {
      await entityService.update(REG_UID, existingSession[0].id, {
        data: {
          ...body,
          sessionId,
          state: 'STARTED',
          expiresAt,
        },
      });
    } else {
      await entityService.create(REG_UID, {
        data: {
          ...body,
          sessionId,
          state: 'STARTED',
          expiresAt,
        },
      });
    }

    const providerOtp = await requestPhoneOtpFromProvider(body.phone);

    await upsertOtp({
      sessionId,
      channel: 'PHONE',
      purpose: 'REGISTER_PHONE',
      target: body.phone,
      otp: providerOtp.otp,
      ...getRequestMeta(ctx),
    });

    return { sessionId, next: 'VERIFY_PHONE_OTP' };
  },

  async verifyPhoneOtp(ctx) {
    const body = validateBody(verifyPhoneOtpSchema, ctx.request.body || {});
    const session = await getRegistrationSession(body.sessionId);

    if (!session || session.phone !== body.phone || isExpired(session.expiresAt)) {
      const error: any = new Error('Invalid registration session');
      error.status = 400;
      throw error;
    }

    await verifyOtp({
      sessionId: body.sessionId,
      channel: 'PHONE',
      purpose: 'REGISTER_PHONE',
      target: body.phone,
      otp: body.otp,
    });

    await entityService.update(REG_UID, session.id, {
      data: {
        state: 'PHONE_VERIFIED',
        phoneVerifiedAt: new Date(),
      },
    });

    return { sessionId: body.sessionId, next: 'REQUEST_EMAIL_OTP' };
  },

  async requestEmailOtp(ctx) {
    assertRateLimit(`otp:email:${ctx.request.ip}`, 20, 60_000);

    const body = validateBody(requestEmailOtpSchema, ctx.request.body || {});
    const session = await getRegistrationSession(body.sessionId);

    if (!session || session.state !== 'PHONE_VERIFIED' || isExpired(session.expiresAt)) {
      const error: any = new Error('Invalid registration session');
      error.status = 400;
      throw error;
    }

    await ensureUniqueEmail(body.email);

    const normalizedEmail = normalizeIdentifier(body.email);
    await entityService.update(REG_UID, session.id, {
      data: {
        email: normalizedEmail,
      },
    });

    const otp = generateOtp();

    await upsertOtp({
      sessionId: body.sessionId,
      channel: 'EMAIL',
      purpose: 'REGISTER_EMAIL',
      target: normalizedEmail,
      otp,
      ...getRequestMeta(ctx),
    });

    await sendEmailOtp(normalizedEmail, otp);

    return { sessionId: body.sessionId, next: 'VERIFY_EMAIL_OTP' };
  },

  async verifyEmailOtp(ctx) {
    const body = validateBody(verifyEmailOtpSchema, ctx.request.body || {});
    const session = await getRegistrationSession(body.sessionId);

    if (!session || !session.email || isExpired(session.expiresAt)) {
      const error: any = new Error('Invalid registration session');
      error.status = 400;
      throw error;
    }

    const normalizedEmail = normalizeIdentifier(body.email);

    if (session.email !== normalizedEmail) {
      const error: any = new Error('Invalid registration session');
      error.status = 400;
      throw error;
    }

    await verifyOtp({
      sessionId: body.sessionId,
      channel: 'EMAIL',
      purpose: 'REGISTER_EMAIL',
      target: normalizedEmail,
      otp: body.otp,
    });

    await entityService.update(REG_UID, session.id, {
      data: {
        state: 'EMAIL_VERIFIED',
        emailVerifiedAt: new Date(),
      },
    });

    return { sessionId: body.sessionId, next: 'SET_PASSWORD_AND_PIN' };
  },

  async completeRegistration(ctx) {
    const body = validateBody(completeRegistrationSchema, ctx.request.body || {});
    const session = await getRegistrationSession(body.sessionId);

    if (!session || session.state !== 'EMAIL_VERIFIED' || isExpired(session.expiresAt)) {
      const error: any = new Error('Invalid registration session');
      error.status = 400;
      throw error;
    }

    const consumedPhoneOtpRows = await entityService.findMany(OTP_UID, {
      filters: {
        sessionId: body.sessionId,
        channel: 'PHONE',
        purpose: 'REGISTER_PHONE',
        target: session.phone,
        consumedAt: { $notNull: true },
      },
      limit: 1,
    });

    const consumedEmailOtpRows = await entityService.findMany(OTP_UID, {
      filters: {
        sessionId: body.sessionId,
        channel: 'EMAIL',
        purpose: 'REGISTER_EMAIL',
        target: session.email,
        consumedAt: { $notNull: true },
      },
      limit: 1,
    });

    const consumedPhoneOtp = Array.isArray(consumedPhoneOtpRows)
      ? consumedPhoneOtpRows[0]
      : consumedPhoneOtpRows;
    const consumedEmailOtp = Array.isArray(consumedEmailOtpRows)
      ? consumedEmailOtpRows[0]
      : consumedEmailOtpRows;

    if (!consumedPhoneOtp || !consumedEmailOtp) {
      const error: any = new Error('OTP verification is incomplete');
      error.status = 400;
      throw error;
    }

    let userId: number | null = null;

    try {
      await ensureUniquePhone(session.phone);
      await ensureUniqueEmail(session.email);

      const generatedUsername = `cus_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const usersPermissionsService = strapi.plugin('users-permissions').service('user');

      const user = await usersPermissionsService.add({
        username: generatedUsername,
        email: normalizeIdentifier(session.email),
        password: body.password,
        confirmed: true,
        blocked: false,
      });

      userId = user.id;

      await entityService.create(PROFILE_UID, {
        data: {
          user: user.id,
          firstName: session.firstName,
          lastName: session.lastName,
          email: session.email,
          phone: session.phone,
          passportNumber: session.passportNumber,
          passportType: session.passportType,
          passportIssueDate: session.passportIssueDate,
          passportValidTill: session.passportValidTill,
          kycStatus: 'NOT_ATTEMPTED',
          kycAttempts: 0,
          pendingForManualVerification: false,
          pinHash: await bcrypt.hash(body.pin, 12),
        },
      });

      await entityService.update(REG_UID, session.id, {
        data: {
          state: 'COMPLETED',
        },
      });

      const otpRowsResult = await entityService.findMany(OTP_UID, {
        filters: { sessionId: body.sessionId },
        limit: 200,
      });
      const otpRows = Array.isArray(otpRowsResult) ? otpRowsResult : [otpRowsResult];

      await Promise.all(
        otpRows.map((row) =>
          entityService.delete(OTP_UID, row.id),
        ),
      );

      return { userId: user.id, next: 'KYC_START_SCREEN' };
    } catch (error) {
      if (userId) {
        await strapi.db.query('plugin::users-permissions.user').delete({
          where: { id: userId },
        });
      }

      throw error;
    }
  },

  async login(ctx) {
    assertRateLimit(`login:${ctx.request.ip}`, LOGIN_MAX_PER_WINDOW, LOGIN_WINDOW_MS);

    const body = validateBody(loginSchema, ctx.request.body || {});
    const identifier = body.identifier.trim();
    const usersPermissionsService = strapi.plugin('users-permissions').service('user');

    let user = null;

    if (isEmailIdentifier(identifier)) {
      user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email: normalizeIdentifier(identifier) },
      });
    } else {
      const profileResult = await entityService.findMany(PROFILE_UID, {
        filters: { phone: identifier },
        populate: { user: true },
        limit: 1,
      });
      const profile = Array.isArray(profileResult) ? profileResult : [profileResult];
      user = profile[0]?.user || null;
    }

    if (!user) {
      const error: any = new Error('Invalid credentials');
      error.status = 400;
      throw error;
    }

    const validPassword = await usersPermissionsService.validatePassword(
      body.password,
      user.password,
    );

    if (!validPassword) {
      const error: any = new Error('Invalid credentials');
      error.status = 400;
      throw error;
    }

    const profileResult = await entityService.findMany(PROFILE_UID, {
      filters: { user: user.id },
      limit: 1,
    });
    const profile = Array.isArray(profileResult) ? profileResult : [profileResult];

    const customerProfile = profile[0];

    if (!customerProfile) {
      const error: any = new Error('Profile not found');
      error.status = 400;
      throw error;
    }

    if (body.pin) {
      const pinValid = await bcrypt.compare(body.pin, customerProfile.pinHash || '');
      if (!pinValid) {
        const error: any = new Error('Invalid credentials');
        error.status = 400;
        throw error;
      }
    }

    const jwt = strapi.plugin('users-permissions').service('jwt').issue({
      id: user.id,
    });

    return {
      jwt,
      user: {
        id: user.id,
        firstName: customerProfile.firstName,
        lastName: customerProfile.lastName,
        kycStatus: customerProfile.kycStatus,
        pendingForManualVerification: customerProfile.pendingForManualVerification,
      },
      expiresIn: '10m',
    };
  },

  hashSensitive,
};
