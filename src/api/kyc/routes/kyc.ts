module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/kyc/start-doc-check',
      handler: 'kyc.startDocCheck',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/kyc/verify-face',
      handler: 'kyc.verifyFace',
      config: {
        auth: false,
      },
    },
  ],
};
