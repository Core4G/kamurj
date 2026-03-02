module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/auth/register/phone/request-otp',
      handler: 'auth-flow.requestPhoneOtp',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/auth/register/phone/verify-otp',
      handler: 'auth-flow.verifyPhoneOtp',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/auth/register/email/request-otp',
      handler: 'auth-flow.requestEmailOtp',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/auth/register/email/verify-otp',
      handler: 'auth-flow.verifyEmailOtp',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/auth/register/complete',
      handler: 'auth-flow.completeRegistration',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/auth/login/verify-credentials',
      handler: 'auth-flow.verifyLoginCredentials',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/auth/login/verify-pin',
      handler: 'auth-flow.verifyLoginPin',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/auth/account',
      handler: 'auth-flow.deleteAccount',
      config: { auth: {} },
    },
  ],
};
