// import type { Core } from '@strapi/strapi';

let otpCleanupInterval: NodeJS.Timeout | null = null;

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
    const runOtpCleanup = async () => {
      const otpUid = 'api::otp-code.otp-code';
      const now = new Date();
      const consumedThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await app.db.query(otpUid).deleteMany({
        where: {
          expiresAt: { $lt: now.toISOString() },
          consumedAt: { $null: true },
        },
      });

      await app.db.query(otpUid).deleteMany({
        where: {
          consumedAt: { $lt: consumedThreshold.toISOString() },
        },
      });
    };

    runOtpCleanup().catch((error) => app.log.error(`OTP cleanup failed: ${error?.message || String(error)}`));

    if (otpCleanupInterval) {
      clearInterval(otpCleanupInterval);
      otpCleanupInterval = null;
    }

    otpCleanupInterval = setInterval(() => {
      runOtpCleanup().catch((error) => app.log.error(`OTP cleanup failed: ${error?.message || String(error)}`));
    }, 5 * 60 * 1000);
  },

  destroy() {
    if (otpCleanupInterval) {
      clearInterval(otpCleanupInterval);
      otpCleanupInterval = null;
    }
  },
};
