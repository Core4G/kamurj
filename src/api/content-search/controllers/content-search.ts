module.exports = {
  async search(ctx) {
    const response = await strapi.service('api::content-search.content-search').search(ctx);
    ctx.status = 200;
    ctx.body = response;
  },
};
