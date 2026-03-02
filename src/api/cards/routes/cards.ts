module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/cards/attach/init',
      handler: 'cards.attachInit',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/cards/attach/complete',
      handler: 'cards.attachComplete',
      config: { auth: {} },
    },
    {
      method: 'GET',
      path: '/cards',
      handler: 'cards.list',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/cards/default',
      handler: 'cards.setDefault',
      config: { auth: {} },
    },
  ],
};
