const getStrapi = () => (globalThis as any).strapi;

const toLogString = (value: unknown) => {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '[unserializable payload]';
  }
};

const runAuthAction = async (ctx: any, actionName: string) => {
  const endpoint = `${ctx.method} ${ctx.path}`;
  const payload = ctx.request?.body ?? {};

  getStrapi().log.info(`[auth-flow] endpoint triggered: ${endpoint} | action=${actionName}`);
  getStrapi().log.info(`[auth-flow] received payload (${actionName}): ${toLogString(payload)}`);

  try {
    const response = await getStrapi().service('api::auth-flow.auth-flow')[actionName](ctx);
    ctx.status = 200;
    ctx.body = response;
    getStrapi().log.info(`[auth-flow] response status (${actionName}): ${ctx.status}`);
  } catch (error: any) {
    const status = error?.status || 500;
    getStrapi().log.error(`[auth-flow] response status (${actionName}): ${status}`);
    throw error;
  }
};

module.exports = {
  async requestPhoneOtp(ctx) {
    await runAuthAction(ctx, 'requestPhoneOtp');
  },

  async verifyPhoneOtp(ctx) {
    await runAuthAction(ctx, 'verifyPhoneOtp');
  },

  async requestEmailOtp(ctx) {
    await runAuthAction(ctx, 'requestEmailOtp');
  },

  async verifyEmailOtp(ctx) {
    await runAuthAction(ctx, 'verifyEmailOtp');
  },

  async completeRegistration(ctx) {
    await runAuthAction(ctx, 'completeRegistration');
  },

  async verifyLoginCredentials(ctx) {
    await runAuthAction(ctx, 'verifyLoginCredentials');
  },

  async verifyLoginPin(ctx) {
    await runAuthAction(ctx, 'verifyLoginPin');
  },

  async deleteAccount(ctx) {
    await runAuthAction(ctx, 'deleteAccount');
  },
};
