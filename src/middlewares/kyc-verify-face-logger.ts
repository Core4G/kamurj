import crypto from 'crypto';

const safeHash = (value: string) => {
  const secret = process.env.SENSITIVE_HASH_SECRET || process.env.JWT_SECRET || 'change-me';
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
};

export default (_config, { strapi }) => {
  return async (ctx, next) => {
    const isVerifyFace = ctx.method === 'POST' && ctx.path === '/api/kyc/verify-face';

    if (!isVerifyFace) {
      await next();
      return;
    }

    const authHeader = String(ctx.request.header?.authorization || ctx.request.headers?.authorization || '');
    const [authType, authTokenRaw] = authHeader.split(' ');
    const authToken = String(authTokenRaw || '').trim();

    strapi.log.info(
      `[kyc] incoming verify-face request: path=${ctx.path} authHeaderPresent=${Boolean(authHeader)} bearer=${authType === 'Bearer' && Boolean(authToken)}`,
    );

    if (authToken) {
      strapi.log.info(`[kyc] incoming verify-face token hash=${safeHash(authToken)}`);

      try {
        const decoded: any = await strapi.plugin('users-permissions').service('jwt').verify(authToken);
        strapi.log.info(
          `[kyc] pre-auth jwt decode: id=${String(decoded?.id || '')} purpose=${String(decoded?.purpose || '')} loginSessionId=${String(decoded?.loginSessionId || '')} exp=${String(decoded?.exp || '')}`,
        );

        if (decoded?.id) {
          const user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: Number(decoded.id) },
            select: ['id', 'blocked', 'confirmed'],
          });

          strapi.log.info(
            `[kyc] pre-auth user lookup: exists=${Boolean(user)} blocked=${String(user?.blocked ?? '')} confirmed=${String(user?.confirmed ?? '')}`,
          );
        }
      } catch (error: any) {
        strapi.log.error(`[kyc] pre-auth jwt verify failed: ${String(error?.message || error)}`);
      }
    }

    try {
      await next();
      strapi.log.info(`[kyc] outgoing verify-face response status=${ctx.status}`);
    } catch (error: any) {
      strapi.log.error(`[kyc] outgoing verify-face response status=${error?.status || 500}`);
      throw error;
    }
  };
};
