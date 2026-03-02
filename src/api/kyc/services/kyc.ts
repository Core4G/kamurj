import { z } from 'zod';
import { callDocProvider, callFaceProvider } from './providers';
import { findMatchingPassport, isDocumentExpired } from './matching';
import { assertRateLimit } from '../../auth-flow/services/rate-limit';

const PROFILE_UID = 'api::customer-profile.customer-profile';
const KYC_SESSION_UID = 'api::kyc-session.kyc-session';
const entityService: any = new Proxy(
  {},
  {
    get(_target, property) {
      return (strapi as any).entityService[property as keyof typeof strapi.entityService];
    },
  },
);

const faceSchema = z.object({
  passportImage: z.string().optional(),
  passportImageRef: z.string().optional(),
});

const getProfileByUser = async (userId: number) => {
  const rows = await entityService.findMany(PROFILE_UID, {
    filters: { user: userId },
    limit: 1,
  });

  return (Array.isArray(rows) ? rows[0] : rows) || null;
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

const failKycAttempt = async (profile, payload: { errorCode: string; errorMessage: string; sessionStatus: string }) => {
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

  await ensureKycSession(profile.user?.id || profile.user, {
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

module.exports = {
  async startDocCheck(ctx) {
    assertRateLimit(`kyc:start:${ctx.request.ip}`, Number(process.env.KYC_START_RATE_MAX || 6), Number(process.env.KYC_START_RATE_WINDOW_MS || 60_000));

    const userId = ctx.state.user?.id;

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

    const passports = providerResponse?.passports || [];

    if (!Array.isArray(passports) || passports.length === 0) {
      return failKycAttempt(profile, {
        errorCode: 'NO_DOC_DATA',
        errorMessage: 'No document records found',
        sessionStatus: 'DOC_FAILED',
      });
    }

    const matched = findMatchingPassport(profile, passports);

    if (!matched) {
      return failKycAttempt(profile, {
        errorCode: 'DOC_MISMATCH',
        errorMessage: 'Passport data mismatch',
        sessionStatus: 'DOC_FAILED',
      });
    }

    if (isDocumentExpired(matched.validTill || profile.passportValidTill)) {
      return failKycAttempt(profile, {
        errorCode: 'DOC_EXPIRED',
        errorMessage: 'Passport expired',
        sessionStatus: 'DOC_FAILED',
      });
    }

    const rawSsn = providerResponse?.ssn ? String(providerResponse.ssn) : null;
    const ssnStoragePolicy = process.env.KYC_SSN_STORAGE || 'HASH';
    const ssnValue = rawSsn
      ? ssnStoragePolicy === 'PLAIN'
        ? rawSsn
        : strapi.service('api::auth-flow.auth-flow').hashSensitive(rawSsn)
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
        matchedPassportNumberLast4: String(matched.number || '').slice(-4),
        validTill: matched.validTill || null,
      },
      errorCode: null,
      errorMessage: null,
    });

    return {
      docMatched: true,
      passportImage: matched.image || null,
      next: 'FACE_VERIFICATION',
    };
  },

  async verifyFace(ctx) {
    const userId = ctx.state.user?.id;

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

    const payload = faceSchema.parse(ctx.request.body || {});

    await ensureKycSession(userId, {
      status: 'FACE_PENDING',
      lastStepAt: new Date(),
    });

    const providerResponse: any = await callFaceProvider({
      videoFile: video,
      passportImage: payload.passportImage,
      passportImageRef: payload.passportImageRef,
    });

    const passed = Boolean(providerResponse?.passed || providerResponse?.status === 'PASSED');

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
        lastKycErrorCode: String(providerResponse?.errorCode || 'FACE_FAILED'),
        lastKycErrorMessage: String(providerResponse?.errorMessage || 'Face verification failed'),
      },
    });

    await ensureKycSession(userId, {
      status: 'FACE_FAILED',
      lastStepAt: new Date(),
      errorCode: String(providerResponse?.errorCode || 'FACE_FAILED'),
      errorMessage: String(providerResponse?.errorMessage || 'Face verification failed'),
    });

    return {
      kycStatus: 'FAILED',
      attemptsLeft: Math.max(0, 3 - attempts),
      pendingForManualVerification,
      retryAllowed: attempts < 3,
    };
  },
};
