module.exports = {
  async requestPhoneOtp(ctx) {
    const response = await strapi.service('api::auth-flow.auth-flow').requestPhoneOtp(ctx);
    ctx.status = 200;
    ctx.body = response;
  },

  async verifyPhoneOtp(ctx) {
    const response = await strapi.service('api::auth-flow.auth-flow').verifyPhoneOtp(ctx);
    ctx.status = 200;
    ctx.body = response;
  },

  async requestEmailOtp(ctx) {
    const response = await strapi.service('api::auth-flow.auth-flow').requestEmailOtp(ctx);
    ctx.status = 200;
    ctx.body = response;
  },

  async verifyEmailOtp(ctx) {
    const response = await strapi.service('api::auth-flow.auth-flow').verifyEmailOtp(ctx);
    ctx.status = 200;
    ctx.body = response;
  },

  async completeRegistration(ctx) {
    const response = await strapi.service('api::auth-flow.auth-flow').completeRegistration(ctx);
    ctx.status = 200;
    ctx.body = response;
  },

  async login(ctx) {
    const response = await strapi.service('api::auth-flow.auth-flow').login(ctx);
    ctx.status = 200;
    ctx.body = response;
  },
};
