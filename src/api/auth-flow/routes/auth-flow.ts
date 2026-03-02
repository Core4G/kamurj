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
      path: '/auth/login',
      handler: 'auth-flow.login',
      config: { auth: false },
    },
  ],
};
