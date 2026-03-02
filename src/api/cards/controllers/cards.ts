module.exports = {
  async attachInit(ctx) {
    const response = await strapi.service('api::cards.cards').attachInit(ctx);
    ctx.status = 200;
    ctx.body = response;
  },

  async attachComplete(ctx) {
    const response = await strapi.service('api::cards.cards').attachComplete(ctx);
    ctx.status = 200;
    ctx.body = response;
  },

  async list(ctx) {
    const response = await strapi.service('api::cards.cards').list(ctx);
    ctx.status = 200;
    ctx.body = response;
  },

  async setDefault(ctx) {
    const response = await strapi.service('api::cards.cards').setDefault(ctx);
    ctx.status = 200;
    ctx.body = response;
  },
};
