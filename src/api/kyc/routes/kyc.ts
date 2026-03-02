module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/kyc/start-doc-check',
      handler: 'kyc.startDocCheck',
      config: {
        auth: {},
      },
    },
    {
      method: 'POST',
      path: '/kyc/verify-face',
      handler: 'kyc.verifyFace',
      config: {
        auth: {},
      },
    },
  ],
};
