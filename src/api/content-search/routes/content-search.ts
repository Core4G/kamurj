module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/content-search',
      handler: 'content-search.search',
      config: { auth: false },
    },
  ],
};
