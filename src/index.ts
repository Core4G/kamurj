// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }) {
    const app = strapi;
    const entityService: any = app.entityService;
    const runOtpCleanup = async () => {
      const otpUid = 'api::otp-code.otp-code';
      const now = new Date();
      const consumedThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const expiredResult = await entityService.findMany(otpUid, {
        filters: {
          expiresAt: { $lt: now.toISOString() },
        },
        limit: 500,
      });
      const expired = Array.isArray(expiredResult) ? expiredResult : [expiredResult];

      const oldConsumedResult = await entityService.findMany(otpUid, {
        filters: {
          consumedAt: { $lt: consumedThreshold.toISOString() },
        },
        limit: 500,
      });
      const oldConsumed = Array.isArray(oldConsumedResult) ? oldConsumedResult : [oldConsumedResult];

      await Promise.all(
        [...expired, ...oldConsumed].filter(Boolean).map((row: any) => entityService.delete(otpUid, row.id)),
      );
    };

    runOtpCleanup().catch((error) => app.log.error(`OTP cleanup failed: ${error?.message || String(error)}`));
    setInterval(() => {
      runOtpCleanup().catch((error) => app.log.error(`OTP cleanup failed: ${error?.message || String(error)}`));
    }, 5 * 60 * 1000);
  },
};
