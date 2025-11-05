module.exports = {
    async getAppContext(ctx) {
        const {locale} = ctx.query;
        try {
            const data = await strapi.service('api::app-context.app-context').getAppContextData(locale);
            ctx.body = data;
        } catch (error) {
            ctx.throw(500, error);
        }
    },
};
