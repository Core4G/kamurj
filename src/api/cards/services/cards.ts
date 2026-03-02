import { z } from 'zod';

const CARD_UID = 'api::payment-card.payment-card';
const entityService: any = new Proxy(
  {},
  {
    get(_target, property) {
      return (strapi as any).entityService[property as keyof typeof strapi.entityService];
    },
  },
);

const completeAttachSchema = z.object({
  bankCardId: z.string().optional(),
  cardToken: z.string().optional(),
  maskedPan: z.string().min(4),
  last4: z.string().regex(/^\d{4}$/),
  brand: z.string().optional(),
  expMonth: z.number().int().min(1).max(12).optional(),
  expYear: z.number().int().min(2000).max(2100).optional(),
  cardholderName: z.string().optional(),
  issuerBank: z.string().optional(),
  country: z.string().optional(),
  fingerprint: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'EXPIRED', 'PENDING_VERIFICATION']).optional(),
  bankCustomerId: z.string().optional(),
});

const setDefaultSchema = z.object({
  cardId: z.number().int().positive(),
});

module.exports = {
  async attachInit(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) {
      ctx.throw(401, 'Unauthorized');
      return;
    }

    return {
      bankSessionId: `bank_${Date.now()}_${userId}`,
      expiresInSeconds: 600,
    };
  },

  async attachComplete(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) {
      ctx.throw(401, 'Unauthorized');
      return;
    }

    const payload = completeAttachSchema.parse(ctx.request.body || {});

    if (!payload.bankCardId && !payload.fingerprint) {
      ctx.throw(400, 'bankCardId or fingerprint is required');
      return;
    }

    const duplicateFilter = payload.fingerprint
      ? { user: userId, fingerprint: payload.fingerprint }
      : { user: userId, bankCardId: payload.bankCardId };

    const existingRows = await entityService.findMany(CARD_UID, {
      filters: duplicateFilter,
      limit: 1,
    });
    const existing = Array.isArray(existingRows) ? existingRows : [existingRows];

    if (existing.length) {
      ctx.throw(409, 'Card already attached');
      return;
    }

    const existingActiveCardsRows = await entityService.findMany(CARD_UID, {
      filters: { user: userId, status: 'ACTIVE' },
      limit: 1,
    });
    const existingActiveCards = Array.isArray(existingActiveCardsRows)
      ? existingActiveCardsRows
      : [existingActiveCardsRows];

    const card = await entityService.create(CARD_UID, {
      data: {
        user: userId,
        bankCardId: payload.bankCardId,
        cardToken: payload.cardToken,
        maskedPan: payload.maskedPan,
        last4: payload.last4,
        brand: payload.brand,
        expMonth: payload.expMonth,
        expYear: payload.expYear,
        cardholderName: payload.cardholderName,
        issuerBank: payload.issuerBank,
        country: payload.country,
        fingerprint: payload.fingerprint,
        status: payload.status || 'ACTIVE',
        isDefault: existingActiveCards.length === 0,
        bankCustomerId: payload.bankCustomerId,
      },
    });

    return { cardId: card.id, status: card.status };
  },

  async list(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) {
      ctx.throw(401, 'Unauthorized');
      return;
    }

    const cardsResult = await entityService.findMany(CARD_UID, {
      filters: { user: userId },
      sort: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    const cards = Array.isArray(cardsResult) ? cardsResult : [cardsResult];

    return {
      data: cards.map((card) => ({
        id: card.id,
        bankCardId: card.bankCardId,
        maskedPan: card.maskedPan,
        last4: card.last4,
        brand: card.brand,
        expMonth: card.expMonth,
        expYear: card.expYear,
        status: card.status,
        isDefault: card.isDefault,
      })),
    };
  },

  async setDefault(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) {
      ctx.throw(401, 'Unauthorized');
      return;
    }

    const payload = setDefaultSchema.parse(ctx.request.body || {});
    const cardsResult = await entityService.findMany(CARD_UID, {
      filters: { user: userId },
      limit: 200,
    });
    const cards = Array.isArray(cardsResult) ? cardsResult : [cardsResult];

    const targetCard = cards.find((card) => Number(card.id) === payload.cardId);

    if (!targetCard) {
      ctx.throw(404, 'Card not found');
      return;
    }

    await Promise.all(
      cards.map((card) =>
        entityService.update(CARD_UID, card.id, {
          data: { isDefault: Number(card.id) === payload.cardId },
        }),
      ),
    );

    return { cardId: payload.cardId, isDefault: true };
  },
};
