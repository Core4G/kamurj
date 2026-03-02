import { z } from 'zod';
import { callDocProvider, callFaceProvider } from './providers';
import { isDocumentExpired, normalizeName } from './matching';
import { assertRateLimit } from '../../auth-flow/services/rate-limit';
import crypto from 'crypto';

const PROFILE_UID = 'api::customer-profile.customer-profile';
const KYC_SESSION_UID = 'api::kyc-session.kyc-session';
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

const faceSchema = z.object({
  sessionId: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  platform: z.string().trim().min(1),
  appVersion: z.string().trim().min(1),
});

const VALID_DOC_STATUSES = new Set(['VALID', 'PRIMARY_VALID']);

const normalizeDocType = (value: string | null | undefined) =>
  String(value || '')
    .trim()
    .toUpperCase();

const normalizeDocumentList = (providerResponse: any) => {
  const fromDocs = Array.isArray(providerResponse?.docs) ? providerResponse.docs : [];
  const fromDocuments = Array.isArray(providerResponse?.documents) ? providerResponse.documents : [];
  const fromPassports = Array.isArray(providerResponse?.passports) ? providerResponse.passports : [];
  const source = fromDocs.length ? fromDocs : fromDocuments.length ? fromDocuments : fromPassports;

  return source.map((item: any) => ({
    number: String(item?.number || item?.docNumber || '').trim(),
    type: normalizeDocType(item?.type || item?.docType || item?.documentType),
    status: normalizeDocType(item?.status || item?.validityStatus || (item?.validFlag ? 'VALID' : 'INVALID')),
    issueDate: item?.issueDate || null,
    validTill: item?.validTill || item?.expiryDate || null,
    name: String(item?.name || item?.firstName || '').trim(),
    surname: String(item?.surname || item?.lastName || '').trim(),
    image: item?.image || item?.documentImage || null,
  }));
};

const docDebugView = (doc: any) => ({
  number: String(doc?.number || '').trim(),
  type: normalizeDocType(doc?.type),
  status: normalizeDocType(doc?.status),
  name: normalizeName(String(doc?.name || '')),
  surname: normalizeName(String(doc?.surname || '')),
  validTill: doc?.validTill || null,
});

const profileDebugView = (profile: any) => ({
  passportNumber: String(profile?.passportNumber || '').trim(),
  passportType: normalizeDocType(profile?.passportType),
  firstName: normalizeName(String(profile?.firstName || '')),
  lastName: normalizeName(String(profile?.lastName || '')),
  passportValidTill: profile?.passportValidTill || null,
});

const buildEncryptionKey = () => {
  const baseSecret =
    process.env.KYC_IMAGE_ENCRYPTION_KEY ||
    process.env.SENSITIVE_HASH_SECRET ||
    process.env.JWT_SECRET ||
    'unsafe-default-key';

  return crypto.createHash('sha256').update(baseSecret).digest();
};

const encryptText = (value: string) => {
  const key = buildEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
};

const decryptText = (payload: string) => {
  const [ivB64, tagB64, contentB64] = String(payload || '').split('.');
  if (!ivB64 || !tagB64 || !contentB64) {
    return null;
  }

  const key = buildEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  const plain = Buffer.concat([
    decipher.update(Buffer.from(contentB64, 'base64')),
    decipher.final(),
  ]);

  return plain.toString('utf8');
};

const getProfileByUser = async (userId: number) => {
  const rows = await entityService.findMany(PROFILE_UID, {
    filters: { user: userId },
    limit: 1,
  });

  return (Array.isArray(rows) ? rows[0] : rows) || null;
};

const resolveAuthenticatedUserId = async (ctx: any) => {
  const stateUserId = Number(ctx.state?.user?.id || 0);
  if (stateUserId > 0) {
    return stateUserId;
  }

  const authHeader = String(ctx.request.header?.authorization || ctx.request.headers?.authorization || '');
  const [authType, authTokenRaw] = authHeader.split(' ');
  const token = String(authTokenRaw || '').trim();

  if (authType !== 'Bearer' || !token) {
    ctx.throw(401, 'Unauthorized');
    return null;
  }

  let payload: any;
  try {
    payload = await getStrapi().plugin('users-permissions').service('jwt').verify(token);
  } catch (_error) {
    ctx.throw(401, 'Unauthorized');
    return null;
  }

  const userId = Number(payload?.id || 0);
  if (!userId) {
    ctx.throw(401, 'Unauthorized');
    return null;
  }

  const user = await getStrapi().db.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
    select: ['id', 'blocked'],
  });

  if (!user || user.blocked) {
    ctx.throw(401, 'Unauthorized');
    return null;
  }

  ctx.state.user = {
    ...(ctx.state.user || {}),
    id: userId,
  };

  return userId;
};

const getLastKycSession = async (userId: number) => {
  const rows = await entityService.findMany(KYC_SESSION_UID, {
    filters: { user: userId },
    sort: { createdAt: 'desc' },
    limit: 1,
  });

  return (Array.isArray(rows) ? rows[0] : rows) || null;
};

const ensureKycSession = async (userId: number, data: Record<string, any>) => {
  const existing = await getLastKycSession(userId);

  if (!existing) {
    return entityService.create(KYC_SESSION_UID, {
      data: {
        user: userId,
        ...data,
      },
    });
  }

  return entityService.update(KYC_SESSION_UID, existing.id, {
    data,
  });
};

const failKycAttempt = async (
  userId: number,
  profile,
  payload: { errorCode: string; errorMessage: string; sessionStatus: string },
) => {
  getStrapi().log.warn(
    `[kyc] start-doc-check failed userId=${String(userId)} profileId=${String(profile?.id || '')} errorCode=${payload.errorCode} message=${payload.errorMessage}`,
  );

  const attempts = (profile.kycAttempts || 0) + 1;
  const pendingForManualVerification = attempts >= 3;

  await entityService.update(PROFILE_UID, profile.id, {
    data: {
      kycAttempts: attempts,
      kycStatus: 'FAILED',
      pendingForManualVerification,
      lastKycErrorCode: payload.errorCode,
      lastKycErrorMessage: payload.errorMessage,
    },
  });

  await ensureKycSession(userId, {
    status: payload.sessionStatus,
    lastStepAt: new Date(),
    errorCode: payload.errorCode,
    errorMessage: payload.errorMessage,
  });

  return {
    docMatched: false,
    kycStatus: 'FAILED',
    attemptsLeft: Math.max(0, 3 - attempts),
    pendingForManualVerification,
    message: payload.errorMessage,
  };
};

const findExistingPassedCustomerBySsn = async (rawSsn: string, currentProfileId: number) => {
  const ssnStoragePolicy = process.env.KYC_SSN_STORAGE || 'HASH';
  const ssnLookupValue =
    ssnStoragePolicy === 'PLAIN'
      ? rawSsn
      : getStrapi().service('api::auth-flow.auth-flow').hashSensitive(rawSsn);

  const rows = await entityService.findMany(PROFILE_UID, {
    filters: {
      ssn: ssnLookupValue,
      kycStatus: 'PASSED',
    },
    limit: 2,
  });

  const matches = Array.isArray(rows) ? rows : [rows];
  return matches.find((entry) => entry && Number(entry.id) !== Number(currentProfileId)) || null;
};

module.exports = {
  async startDocCheck(ctx) {
    assertRateLimit(`kyc:start:${ctx.request.ip}`, Number(process.env.KYC_START_RATE_MAX || 6), Number(process.env.KYC_START_RATE_WINDOW_MS || 60_000));

    const userId = await resolveAuthenticatedUserId(ctx);

    if (!userId) {
      ctx.throw(401, 'Unauthorized');
      return;
    }

    const profile = await getProfileByUser(userId);

    if (!profile) {
      ctx.throw(404, 'Customer profile not found');
      return;
    }

    if (profile.kycStatus === 'PASSED') {
      ctx.throw(409, 'KYC already passed');
      return;
    }

    if (profile.pendingForManualVerification) {
      ctx.throw(403, 'Manual review required');
      return;
    }

    if ((profile.kycAttempts || 0) >= 3) {
      await entityService.update(PROFILE_UID, profile.id, {
        data: {
          pendingForManualVerification: true,
          kycStatus: 'FAILED',
        },
      });
      ctx.throw(403, 'Manual review required');
      return;
    }

    await entityService.update(PROFILE_UID, profile.id, {
      data: {
        kycStatus: 'PENDING',
      },
    });

    await ensureKycSession(userId, {
      status: 'DOC_PENDING',
      lastStepAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      errorCode: null,
      errorMessage: null,
    });

    const providerResponse: any = await callDocProvider({
      passportNumber: profile.passportNumber,
      passportType: profile.passportType,
      passportIssueDate: profile.passportIssueDate,
      passportValidTill: profile.passportValidTill,
      firstName: profile.firstName,
      lastName: profile.lastName,
    });

    const rawSsn = providerResponse?.ssn ? String(providerResponse.ssn).trim() : '';
    const documents = normalizeDocumentList(providerResponse);

    getStrapi().log.info(
      `[kyc] start-doc-check snapshot userId=${String(userId)} profile=${JSON.stringify(profileDebugView(profile))} providerSsnPresent=${Boolean(rawSsn)} docsCount=${documents.length}`,
    );

    documents.forEach((doc: any, index: number) => {
      getStrapi().log.info(`[kyc] provider doc[${index}] ${JSON.stringify(docDebugView(doc))}`);
    });

    if (!rawSsn) {
      return failKycAttempt(userId, profile, {
        errorCode: 'MISSING_SSN',
        errorMessage: 'Invalid data',
        sessionStatus: 'DOC_FAILED',
      });
    }

    const existingPassedCustomer = await findExistingPassedCustomerBySsn(rawSsn, profile.id);
    if (existingPassedCustomer) {
      ctx.throw(409, 'Customer already exists');
      return;
    }

    if (!Array.isArray(documents) || documents.length === 0) {
      return failKycAttempt(userId, profile, {
        errorCode: 'NO_DOC_DATA',
        errorMessage: 'No document records found',
        sessionStatus: 'DOC_FAILED',
      });
    }

    const matchesRegistrationData = (doc: any) => {
      return (
        normalizeDocType(doc.type) === normalizeDocType(profile.passportType) &&
        String(doc.number || '').trim() === String(profile.passportNumber || '').trim() &&
        normalizeName(doc.name) === normalizeName(profile.firstName) &&
        normalizeName(doc.surname) === normalizeName(profile.lastName)
      );
    };

    const explainMatch = (doc: any) => {
      const expectedType = normalizeDocType(profile.passportType);
      const expectedNumber = String(profile.passportNumber || '').trim();
      const expectedFirstName = normalizeName(profile.firstName);
      const expectedLastName = normalizeName(profile.lastName);

      const actualType = normalizeDocType(doc.type);
      const actualNumber = String(doc.number || '').trim();
      const actualFirstName = normalizeName(doc.name);
      const actualLastName = normalizeName(doc.surname);

      return {
        typeMatches: actualType === expectedType,
        numberMatches: actualNumber === expectedNumber,
        firstNameMatches: actualFirstName === expectedFirstName,
        lastNameMatches: actualLastName === expectedLastName,
        expected: {
          type: expectedType,
          number: expectedNumber,
          firstName: expectedFirstName,
          lastName: expectedLastName,
        },
        actual: {
          type: actualType,
          number: actualNumber,
          firstName: actualFirstName,
          lastName: actualLastName,
        },
      };
    };

    const validDocs = documents.filter((doc) => VALID_DOC_STATUSES.has(normalizeDocType(doc.status)));
    const matchedValidDoc = validDocs.find(matchesRegistrationData);

    if (!matchedValidDoc) {
      const matchedAnyDoc = documents.find(matchesRegistrationData);

      documents.forEach((doc: any, index: number) => {
        getStrapi().log.info(
          `[kyc] match evaluation doc[${index}] ${JSON.stringify({ ...explainMatch(doc), status: normalizeDocType(doc.status) })}`,
        );
      });

      if (matchedAnyDoc) {
        getStrapi().log.warn('[kyc] start-doc-check result: document matched identity data but status is not valid');
        return failKycAttempt(userId, profile, {
          errorCode: 'DOC_NOT_VALID',
          errorMessage: 'Provide a valid document data',
          sessionStatus: 'DOC_FAILED',
        });
      }

      getStrapi().log.warn('[kyc] start-doc-check result: no provider document matched registration identity data');

      return failKycAttempt(userId, profile, {
        errorCode: 'DOC_MISMATCH',
        errorMessage: 'Invalid data',
        sessionStatus: 'DOC_FAILED',
      });
    }

    if (isDocumentExpired(matchedValidDoc.validTill || profile.passportValidTill)) {
      getStrapi().log.warn(
        `[kyc] start-doc-check result: matched document is expired validTill=${String(matchedValidDoc.validTill || profile.passportValidTill || '')}`,
      );
      return failKycAttempt(userId, profile, {
        errorCode: 'DOC_EXPIRED',
        errorMessage: 'Provide a valid document data',
        sessionStatus: 'DOC_FAILED',
      });
    }

    const encryptedPassportImage = matchedValidDoc.image ? encryptText(String(matchedValidDoc.image)) : null;
    const ssnStoragePolicy = process.env.KYC_SSN_STORAGE || 'HASH';
    const ssnValue = rawSsn
      ? ssnStoragePolicy === 'PLAIN'
        ? rawSsn
        : getStrapi().service('api::auth-flow.auth-flow').hashSensitive(rawSsn)
      : null;

    await entityService.update(PROFILE_UID, profile.id, {
      data: {
        ssn: ssnValue,
        lastKycErrorCode: null,
        lastKycErrorMessage: null,
      },
    });

    await ensureKycSession(userId, {
      status: 'DOC_MATCHED',
      lastStepAt: new Date(),
      docMatchSummary: {
        hasMatch: true,
        matchedPassportNumberLast4: String(matchedValidDoc.number || '').slice(-4),
        validTill: matchedValidDoc.validTill || null,
        matchedDocType: matchedValidDoc.type || null,
        encryptedPassportImage,
      },
      errorCode: null,
      errorMessage: null,
    });

    return {
      docMatched: true,
      next: 'FACE_VERIFICATION',
    };
  },

  async verifyFace(ctx) {
    const authHeader = String(ctx.request.header?.authorization || ctx.request.headers?.authorization || '');
    const [authType, authTokenRaw] = authHeader.split(' ');
    const authToken = (authTokenRaw || '').trim();
    const hasBearerToken = authType === 'Bearer' && Boolean(authToken);

    getStrapi().log.info(`[kyc] verifyFace auth header present=${Boolean(authHeader)} bearer=${hasBearerToken}`);
    if (authToken) {
      getStrapi().log.info(`[kyc] verifyFace token hash=${getStrapi().service('api::auth-flow.auth-flow').hashSensitive(authToken)}`);
    }

    if (hasBearerToken) {
      try {
        const decoded = await getStrapi().plugin('users-permissions').service('jwt').verify(authToken);
        getStrapi().log.info(
          `[kyc] verifyFace decoded token payload: id=${String(decoded?.id || '')} purpose=${String(decoded?.purpose || '')} loginSessionId=${String(decoded?.loginSessionId || '')}`,
        );
      } catch (error: any) {
        getStrapi().log.error(`[kyc] verifyFace token verification failed: ${String(error?.message || error)}`);
      }
    }

    getStrapi().log.info(`[kyc] verifyFace resolved ctx.state.user.id=${String(ctx.state?.user?.id || '')}`);

    const userId = await resolveAuthenticatedUserId(ctx);

    if (!userId) {
      ctx.throw(401, 'Unauthorized');
      return;
    }

    const profile = await getProfileByUser(userId);

    if (!profile) {
      ctx.throw(404, 'Customer profile not found');
      return;
    }

    const session = await getLastKycSession(userId);

    if (!session || session.status !== 'DOC_MATCHED' || profile.kycStatus !== 'PENDING') {
      ctx.throw(400, 'Document step is not completed');
      return;
    }

    const files = ctx.request.files || {};
    const video = files.video;

    if (!video) {
      ctx.throw(400, 'Video is required');
      return;
    }

    const videoMimeType = String(video?.mimetype || '');
    if (!['video/mp4', 'video/quicktime'].includes(videoMimeType)) {
      ctx.throw(400, 'Video must be video/mp4 or video/quicktime');
      return;
    }

    const payload = faceSchema.parse(ctx.request.body || {});

    let passportImageForProvider: string | undefined;
    if (session?.docMatchSummary?.encryptedPassportImage) {
      passportImageForProvider = decryptText(session.docMatchSummary.encryptedPassportImage) || undefined;
    }

    if (!passportImageForProvider) {
      ctx.throw(400, 'Passport image is not available');
      return;
    }

    await ensureKycSession(userId, {
      status: 'FACE_PENDING',
      lastStepAt: new Date(),
    });

    const providerResponse: any = await callFaceProvider({
      videoFile: video,
      passportImage: passportImageForProvider,
      sessionId: payload.sessionId,
      deviceId: payload.deviceId,
      platform: payload.platform,
      appVersion: payload.appVersion,
    });

    const providerStatus = String(providerResponse?.status || '').toUpperCase();
    const passed = providerStatus === 'PASS' || Boolean(providerResponse?.passed || providerResponse?.status === 'PASSED');

    if (passed) {
      await entityService.update(PROFILE_UID, profile.id, {
        data: {
          kycStatus: 'PASSED',
          lastKycErrorCode: null,
          lastKycErrorMessage: null,
        },
      });

      await ensureKycSession(userId, {
        status: 'FACE_PASSED',
        lastStepAt: new Date(),
        errorCode: null,
        errorMessage: null,
      });

      return { kycStatus: 'PASSED' };
    }

    const attempts = (profile.kycAttempts || 0) + 1;
    const pendingForManualVerification = attempts >= 3;

    await entityService.update(PROFILE_UID, profile.id, {
      data: {
        kycStatus: 'FAILED',
        kycAttempts: attempts,
        pendingForManualVerification,
        lastKycErrorCode: String(providerResponse?.errorCode || providerStatus || 'FACE_FAILED'),
        lastKycErrorMessage: String((providerResponse?.reasons || []).join(', ') || providerResponse?.errorMessage || 'Face verification failed'),
      },
    });

    await ensureKycSession(userId, {
      status: 'FACE_FAILED',
      lastStepAt: new Date(),
      errorCode: String(providerResponse?.errorCode || providerStatus || 'FACE_FAILED'),
      errorMessage: String((providerResponse?.reasons || []).join(', ') || providerResponse?.errorMessage || 'Face verification failed'),
    });

    return {
      kycStatus: 'FAILED',
      attemptsLeft: Math.max(0, 3 - attempts),
      pendingForManualVerification,
      retryAllowed: attempts < 3,
    };
  },
};
