module.exports = {
  async startDocCheck(ctx) {
    const response = await strapi.service('api::kyc.kyc').startDocCheck(ctx);
    ctx.status = 200;
    ctx.body = response;
  },

  async verifyFace(ctx) {
    const response = await strapi.service('api::kyc.kyc').verifyFace(ctx);
    ctx.status = 200;
    ctx.body = response;
  },
};
