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
    ],
};
