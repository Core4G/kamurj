module.exports = {
    routes: [
        {
            method: 'GET',
            path: '/app-context',
            handler: 'app-context.getAppContext',
            config: {
                auth: false,
            },
        },
        {
            method: 'GET',
            path: '/page-data/:pageName',
            handler: 'app-context.getPageData',
            config: {
                auth: false,
            },
        },
    ],
};
