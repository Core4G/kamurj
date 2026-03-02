const getKycStrapi = () => (globalThis as any).strapi;

const toKycLogString = (value: unknown) => {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '[unserializable payload]';
  }
};

module.exports = {
  async startDocCheck(ctx) {
    const response = await strapi.service('api::kyc.kyc').startDocCheck(ctx);
    ctx.status = 200;
    ctx.body = response;
  },

  async verifyFace(ctx) {
    const endpoint = `${ctx.method} ${ctx.path}`;
    getKycStrapi().log.info(`[kyc] endpoint triggered: ${endpoint} | action=verifyFace`);
    getKycStrapi().log.info(`[kyc] received payload (verifyFace): ${toKycLogString(ctx.request?.body || {})}`);

    try {
      const response = await strapi.service('api::kyc.kyc').verifyFace(ctx);
      ctx.status = 200;
      ctx.body = response;
      getKycStrapi().log.info(`[kyc] response status (verifyFace): ${ctx.status}`);
    } catch (error: any) {
      const status = error?.status || 500;
      getKycStrapi().log.error(`[kyc] response status (verifyFace): ${status}`);
      throw error;
    }
  },
};
