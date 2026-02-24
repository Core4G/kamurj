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

    async getPageData(ctx) {
        const { locale } = ctx.query;
        const { pageName } = ctx.params;

        try {
            const data = await strapi.service('api::app-context.app-context').getPageData(locale, pageName);
            ctx.status = 200;
            ctx.body = { data: data ?? null };
        } catch (error: any) {
            const message = error?.message || 'Failed to fetch page data';

            if (message.startsWith('Invalid page name') || message.startsWith('Unknown page content type') || message.startsWith('Unsupported page structure')) {
                ctx.throw(400, message);
                return;
            }

            ctx.throw(500, error);
        }
    },
};
