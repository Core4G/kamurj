module.exports = {
  async getAppContextData(locale) {
    const globals = await strapi.entityService.findMany("api::global.global", {
      filters: { locale: locale || "hy" },
      populate: {
        src: true,
      },
    });

    const languages = await strapi.entityService.findMany(
      "api::language.language",
      {
        filters: { publishedAt: { $notNull: true } },
        populate: {
          iconUrl: true,
        },
      },
    );

    const loanGroups = await strapi.entityService.findMany(
      "api::loan-group.loan-group",
      {
        filters: { locale: locale || "hy", publishedAt: { $notNull: true } },
        populate: {
          imageSrc: true,
          iconSrc: true,
          activeIconSrc: true,
          loans: {
            populate: {
              imageSrc: true,
              loan_currencies: { populate: { icon: true } },
            },
          },
        },
      },
    );

    const topLoans = await strapi.entityService.findMany("api::loan.loan", {
      filters: {
        locale: locale || "hy",
        publishedAt: { $notNull: true },
        isTopLoan: { $eq: true },
      },
      populate: {
        imageSrc: true,
        iconSrc: true,
      },
    });

    const news = await strapi.entityService.findMany("api::new.new", {
      filters: {
        locale: locale || "hy",
        publishedAt: { $notNull: true },
      },
      populate: {
        imageSrc: true,
      },
    });

    const currencies = await strapi.entityService.findMany(
      "api::exchange-rate.exchange-rate",
      {
        filters: {
          locale: locale || "hy",
          publishedAt: { $notNull: true },
        },
      },
    );

    return { globals, languages, loanGroups, topLoans, news, currencies };
  },
};
