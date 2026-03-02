import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { assertRateLimit } from './rate-limit';
import {
  completeRegistrationSchema,
  loginCredentialsSchema,
  loginPinSchema,
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
const CARD_UID = 'api::payment-card.payment-card';
const KYC_SESSION_UID = 'api::kyc-session.kyc-session';

const REGISTRATION_SESSION_TTL_MINUTES = Number(process.env.REGISTRATION_SESSION_TTL_MINUTES || 30);
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_RATE_WINDOW_MS || 60_000);
const LOGIN_MAX_PER_WINDOW = Number(process.env.LOGIN_RATE_MAX_PER_WINDOW || 10);
const LOGIN_SESSION_TTL_SECONDS = Number(process.env.LOGIN_SESSION_TTL_SECONDS || 300);
const LOGIN_PIN_MAX_ATTEMPTS = Number(process.env.LOGIN_PIN_MAX_ATTEMPTS || 5);
const LOGIN_PRE_PIN_TOKEN_TTL = String(process.env.LOGIN_PRE_PIN_TOKEN_TTL || '5m');
const LOGIN_PRE_PIN_TOKEN_PURPOSE = 'LOGIN_PRE_PIN';
const loginSessions = new Map<string, {
  userId: number;
  expiresAt: number;
  attemptsLeft: number;
  issuedPrePinToken: string;
}>();
const getStrapi = () => {
  const app = (globalThis as any).strapi;
  if (!app) {
    throw new Error('Strapi instance is not available');
  }
  return app;
};
const entityService: any = new Proxy(
  {},
  {
    get(_target, property) {
      const app = getStrapi();
      return app.entityService[property as keyof typeof app.entityService];
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

const getLoginSession = (loginSessionId: string) => {
  const session = loginSessions.get(loginSessionId);

  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    loginSessions.delete(loginSessionId);
    return null;
  }

  return session;
};

const extractBearerToken = (ctx: any) => {
  const header = String(ctx.request.header?.authorization || ctx.request.headers?.authorization || '');
  const [type, token] = header.split(' ');

  if (type !== 'Bearer' || !token) {
    const error: any = new Error('Authorization token is required');
    error.status = 401;
    throw error;
  }

  return token.trim();
};

const resolveUserAndProfileByIdentifier = async (identifier: string) => {
  let user = null;

  if (isEmailIdentifier(identifier)) {
    user = await getStrapi().db.query('plugin::users-permissions.user').findOne({
      where: { email: normalizeIdentifier(identifier) },
    });
  } else {
    const profileByPhoneResult = await entityService.findMany(PROFILE_UID, {
      filters: { phone: identifier },
      populate: { user: true },
      limit: 1,
    });
    const profileByPhone = Array.isArray(profileByPhoneResult) ? profileByPhoneResult : [profileByPhoneResult];
    user = profileByPhone[0]?.user || null;
  }

  if (!user) {
    return { user: null, customerProfile: null };
  }

  const profileResult = await entityService.findMany(PROFILE_UID, {
    filters: { user: user.id },
    limit: 1,
  });
  const profile = Array.isArray(profileResult) ? profileResult : [profileResult];

  return { user, customerProfile: profile[0] || null };
};

const getRequestMeta = (ctx) => ({
  ip: ctx.request.ip,
  userAgent: String(ctx.request.header['user-agent'] || ''),
});

const hashSensitive = (value: string) => {
  const secret = process.env.SENSITIVE_HASH_SECRET || process.env.JWT_SECRET || 'change-me';
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
};

const shouldLogRawTokens = process.env.AUTH_FLOW_LOG_RAW_TOKENS === 'true';

const tokenLogView = (token: string) => {
  if (!token) {
    return '(empty)';
  }

  if (shouldLogRawTokens) {
    return token;
  }

  const start = token.slice(0, 12);
  const end = token.slice(-8);
  return `${start}...${end}`;
};

const requestPhoneOtpFromProvider = async (phone: string) => {
  const mockEnabled = process.env.MOCK_PHONE_OTP_ENABLED !== 'false';
  const mockOtp = String(process.env.MOCK_PHONE_OTP_CODE || '123456');

  if (mockEnabled) {
    getStrapi().log.info(`Phone OTP mock mode enabled. Returning mocked OTP for ${phone}`);
    return { otp: mockOtp, providerRequestId: 'mock-provider-request-id' };
  }

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
    getStrapi().log.warn(`SMS provider not configured. Local OTP fallback is used for ${phone}`);
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
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    getStrapi().log.error('[auth-flow] Email provider configuration missing: GMAIL_USER and/or GMAIL_APP_PASSWORD');
    const error: any = new Error('Email OTP provider is not configured');
    error.status = 503;
    throw error;
  }

  try {
    await getStrapi().plugin('email').service('email').send({
      to: email,
      subject: 'Your OTP code',
      text: `Your OTP is ${otp}`,
    });
  } catch (cause: any) {
    const message = String(cause?.message || '');
    const authFailed = cause?.code === 'EAUTH' || /invalid login|badcredentials|username and password not accepted/i.test(message);

    if (authFailed) {
      getStrapi().log.error('[auth-flow] SMTP auth failed for email OTP. Verify Gmail app password and account security settings.');
      const error: any = new Error('Email OTP provider authentication failed');
      error.status = 502;
      throw error;
    }

    getStrapi().log.error(`[auth-flow] Email OTP send failed: ${message}`);
    const error: any = new Error('Email OTP provider request failed');
    error.status = 502;
    throw error;
  }
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
  const existingUser = await getStrapi().db.query('plugin::users-permissions.user').findOne({
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

    const incomingBody = ctx.request.body || {};
    getStrapi().log.info(`[requestPhoneOtp] received payload phone=${String(incomingBody?.phone ?? '')}`);

    const body = validateBody(registerPhoneSchema, incomingBody);
    getStrapi().log.info(`[requestPhoneOtp] normalized phone=${String(body.phone)}`);
    getStrapi().log.info(
      `[requestPhoneOtp] registration identity firstName=${String(body.firstName)} lastName=${String(body.lastName)} passportNumber=${String(body.passportNumber)} passportType=${String(body.passportType)}`,
    );
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

    if (session) {
      getStrapi().log.info(
        `[completeRegistration] session snapshot sessionId=${String(body.sessionId)} phone=${String(session.phone || '')} email=${String(session.email || '')} passportNumber=${String(session.passportNumber || '')}`,
      );
    }

    if (!session || session.state !== 'EMAIL_VERIFIED' || isExpired(session.expiresAt)) {
      const error: any = new Error('Invalid registration session');
      error.status = 400;
      throw error;
    }

    if (!session.phoneVerifiedAt || !session.emailVerifiedAt) {
      const error: any = new Error('OTP verification is incomplete');
      error.status = 400;
      throw error;
    }

    let userId: number | null = null;

    try {
      await ensureUniquePhone(session.phone);
      await ensureUniqueEmail(session.email);

      const generatedUsername = `cus_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const usersPermissionsService = getStrapi().plugin('users-permissions').service('user');

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
        await getStrapi().db.query('plugin::users-permissions.user').delete({
          where: { id: userId },
        });
      }

      throw error;
    }
  },

  async verifyLoginCredentials(ctx) {
    assertRateLimit(`login:${ctx.request.ip}`, LOGIN_MAX_PER_WINDOW, LOGIN_WINDOW_MS);

    const body = validateBody(loginCredentialsSchema, ctx.request.body || {});
    const identifier = body.identifier.trim();
    const usersPermissionsService = getStrapi().plugin('users-permissions').service('user');

    const { user } = await resolveUserAndProfileByIdentifier(identifier);

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

    const loginSessionId = randomUUID();

    const prePinToken = getStrapi().plugin('users-permissions').service('jwt').issue(
      {
        id: user.id,
        purpose: LOGIN_PRE_PIN_TOKEN_PURPOSE,
        loginSessionId,
      },
      { expiresIn: LOGIN_PRE_PIN_TOKEN_TTL },
    );

    loginSessions.set(loginSessionId, {
      userId: user.id,
      expiresAt: Date.now() + LOGIN_SESSION_TTL_SECONDS * 1000,
      attemptsLeft: LOGIN_PIN_MAX_ATTEMPTS,
      issuedPrePinToken: prePinToken,
    });

    getStrapi().log.info(`[auth-flow] issued pre-pin token for loginSessionId=${loginSessionId} token=${tokenLogView(prePinToken)}`);
    getStrapi().log.info(`[auth-flow] issued pre-pin token hash for loginSessionId=${loginSessionId}: ${hashSensitive(prePinToken)}`);

    return {
      token: prePinToken,
      next: 'VERIFY_PIN',
      expiresInSeconds: LOGIN_SESSION_TTL_SECONDS,
    };
  },

  async verifyLoginPin(ctx) {
    assertRateLimit(`login-pin:${ctx.request.ip}`, LOGIN_MAX_PER_WINDOW, LOGIN_WINDOW_MS);

    const body = validateBody(loginPinSchema, ctx.request.body || {});
    const token = extractBearerToken(ctx);
    const jwtService = getStrapi().plugin('users-permissions').service('jwt');

    let tokenPayload: any;
    try {
      tokenPayload = await jwtService.verify(token);
      getStrapi().log.info(`[auth-flow] verifyLoginPin received token=${tokenLogView(token)}`);
      getStrapi().log.info(`[auth-flow] verifyLoginPin received token hash: ${hashSensitive(token)}`);
      getStrapi().log.info(`[auth-flow] verifyLoginPin decoded payload keys: ${Object.keys(tokenPayload || {}).join(',')}`);
    } catch (_error) {
      const error: any = new Error('Invalid or expired login token');
      error.status = 401;
      throw error;
    }

    if (tokenPayload?.purpose !== LOGIN_PRE_PIN_TOKEN_PURPOSE || !tokenPayload?.loginSessionId) {
      getStrapi().log.error(
        `[auth-flow] verifyLoginPin invalid token payload: purpose=${String(tokenPayload?.purpose || '')} loginSessionId=${String(tokenPayload?.loginSessionId || '')}`,
      );
      getStrapi().log.error('[auth-flow] verifyLoginPin comparison skipped: token does not contain required pre-pin claims');
      const error: any = new Error('Invalid login token');
      error.status = 401;
      throw error;
    }

    const session = getLoginSession(String(tokenPayload.loginSessionId));

    if (!session) {
      const error: any = new Error('Invalid or expired login session');
      error.status = 400;
      throw error;
    }

    const tokensMatch = session.issuedPrePinToken === token;
    getStrapi().log.info(
      `[auth-flow] pre-pin token comparison for loginSessionId=${String(tokenPayload.loginSessionId)} matched=${tokensMatch}`,
    );
    getStrapi().log.info(
      `[auth-flow] issued token for comparison=${tokenLogView(session.issuedPrePinToken)} received token=${tokenLogView(token)}`,
    );
    getStrapi().log.info(
      `[auth-flow] issued token hash=${hashSensitive(session.issuedPrePinToken)} received token hash=${hashSensitive(token)}`,
    );

    if (Number(session.userId) !== Number(tokenPayload.id)) {
      const error: any = new Error('Invalid login token');
      error.status = 401;
      throw error;
    }

    const user = await getStrapi().db.query('plugin::users-permissions.user').findOne({
      where: { id: session.userId },
    });

    if (!user) {
      loginSessions.delete(String(tokenPayload.loginSessionId));
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
      loginSessions.delete(String(tokenPayload.loginSessionId));
      const error: any = new Error('Profile not found');
      error.status = 400;
      throw error;
    }

    const pinValid = await bcrypt.compare(body.pin, customerProfile.pinHash || '');
    if (!pinValid) {
      session.attemptsLeft -= 1;

      if (session.attemptsLeft <= 0) {
        loginSessions.delete(String(tokenPayload.loginSessionId));
      } else {
        loginSessions.set(String(tokenPayload.loginSessionId), session);
      }

      const error: any = new Error('Invalid credentials');
      error.status = 400;
      error.details = { attemptsLeft: Math.max(0, session.attemptsLeft) };
      throw error;
    }

    loginSessions.delete(String(tokenPayload.loginSessionId));

    const jwt = getStrapi().plugin('users-permissions').service('jwt').issue({
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

  async deleteAccount(ctx) {
    const authUser = ctx.state?.user;

    if (!authUser?.id) {
      const error: any = new Error('Unauthorized');
      error.status = 401;
      throw error;
    }

    const userId = Number(authUser.id);
    const user = await getStrapi().db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
    });

    if (!user) {
      const error: any = new Error('User not found');
      error.status = 404;
      throw error;
    }

    const profileResult = await entityService.findMany(PROFILE_UID, {
      filters: { user: userId },
      limit: 1,
    });
    const profile = (Array.isArray(profileResult) ? profileResult : [profileResult]).filter(Boolean)[0] || null;

    const cardsResult = await entityService.findMany(CARD_UID, {
      filters: { user: userId },
      limit: 500,
    });
    const cards = (Array.isArray(cardsResult) ? cardsResult : [cardsResult]).filter(Boolean);

    const kycSessionsResult = await entityService.findMany(KYC_SESSION_UID, {
      filters: { user: userId },
      limit: 500,
    });
    const kycSessions = (Array.isArray(kycSessionsResult) ? kycSessionsResult : [kycSessionsResult]).filter(Boolean);

    const registrationFilters: any[] = [];
    const normalizedUserEmail = user.email ? normalizeIdentifier(String(user.email)) : null;
    const normalizedProfileEmail = profile?.email ? normalizeIdentifier(String(profile.email)) : null;

    if (profile?.phone) {
      registrationFilters.push({ phone: profile.phone });
    }
    if (normalizedProfileEmail) {
      registrationFilters.push({ email: normalizedProfileEmail });
    }
    if (normalizedUserEmail && normalizedUserEmail !== normalizedProfileEmail) {
      registrationFilters.push({ email: normalizedUserEmail });
    }

    const registrationSessionsResult = registrationFilters.length
      ? await entityService.findMany(REG_UID, {
        filters: { $or: registrationFilters },
        limit: 500,
      })
      : [];
    const registrationSessions = (Array.isArray(registrationSessionsResult)
      ? registrationSessionsResult
      : [registrationSessionsResult]).filter(Boolean);
    const registrationSessionIds = registrationSessions
      .map((session: any) => String(session.sessionId || ''))
      .filter(Boolean);

    const otpRowsResult = registrationSessionIds.length
      ? await entityService.findMany(OTP_UID, {
        filters: { sessionId: { $in: registrationSessionIds } },
        limit: 1000,
      })
      : [];
    const otpRows = (Array.isArray(otpRowsResult) ? otpRowsResult : [otpRowsResult]).filter(Boolean);

    await Promise.all(otpRows.map((row: any) => entityService.delete(OTP_UID, row.id)));
    await Promise.all(registrationSessions.map((row: any) => entityService.delete(REG_UID, row.id)));
    await Promise.all(cards.map((row: any) => entityService.delete(CARD_UID, row.id)));
    await Promise.all(kycSessions.map((row: any) => entityService.delete(KYC_SESSION_UID, row.id)));

    if (profile?.id) {
      await entityService.delete(PROFILE_UID, profile.id);
    }

    for (const [sessionKey, sessionValue] of loginSessions.entries()) {
      if (Number(sessionValue.userId) === userId) {
        loginSessions.delete(sessionKey);
      }
    }

    await getStrapi().db.query('plugin::users-permissions.user').delete({
      where: { id: userId },
    });

    return {
      deleted: true,
      removed: {
        cards: cards.length,
        kycSessions: kycSessions.length,
        registrationSessions: registrationSessions.length,
        otpRows: otpRows.length,
      },
    };
  },

  hashSensitive,
};
