type NewsOptionItem = {
  showOnMainPage?: boolean;
  [key: string]: any;
};

type OptionItem = {
  newsList?: NewsOptionItem[];
  [key: string]: any;
};

type NewsOptionBlock = {
  optionItems?: OptionItem[];
  [key: string]: any;
};

type NewsPage = {
  newsOptions?: NewsOptionBlock[];
  [key: string]: any;
};

module.exports = {
  async getAppContextData(locale) {
    try {
      const globals = await strapi.entityService.findMany(
        "api::global.global",
        {
          filters: { locale: locale || "hy" },
          populate: {
            src: true,
          },
        },
      );

      const languages = await strapi.entityService.findMany("api::language.language", {
        status: "published",
        populate: { iconUrl: true },
      });

      const loanGroups = await strapi.entityService.findMany(
        "api::loan-group.loan-group",
        {
          filters: { locale: locale || "hy"},
          populate: {
            iconSrc: true,
            activeIconSrc: true,
          },
        },
      );

      const loans = await strapi.entityService.findMany("api::loan.loan", {
        filters: {
          locale: locale || "hy"
        },
        populate: {
          purpose: true,
          loan_group: true,
          mainImageSrc: true,
          widgetImageSrc: true,
          iconSrc: true,
          loan_currencies: {
            on: {
              "loan-currency.loan-currency": {
                populate: {
                  icon: true,
                },
              },
            },
          },
          terms: {
            on: {
              "details-panel.details-panel": {
                populate: {
                  iconSrc: true,
                  tables: {
                    populate: {
                      rows: {
                        populate: {
                          cells: true,
                        },
                      },
                    },
                  },
                  rows: {
                    populate: {
                      iconSrc: true,
                    },
                  },
                },
              },
              "single-row-list.single-row-list": {
                populate: {
                  rows: {
                    populate: {
                      iconSrc: true,
                    },
                  },
                },
              },
              "single-row.single-row": {
                populate: {
                  iconSrc: true,
                },
              },
            },
          },
          docs: {
            on: {
              "single-row.single-row": {
                populate: {
                  iconSrc: true,
                },
              },
            },
          },
        },
      });

      const filteredLoanCurrencies: Record<string, any[]> = {};

      loans.forEach((loan: any) => {
        const groupId = loan?.loan_group?.id;
        const loanCurrencies = loan?.loan_currencies || [];

        if (!loanCurrencies.length) {
          return;
        }

        if (groupId !== undefined && groupId !== null) {
          if (!filteredLoanCurrencies[groupId]) {
            filteredLoanCurrencies[groupId] = [];
          }
          filteredLoanCurrencies[groupId].push(...loanCurrencies);
        }

        if (!filteredLoanCurrencies["all"]) {
          filteredLoanCurrencies["all"] = [];
        }
        filteredLoanCurrencies["all"].push(...loanCurrencies);
      });

      Object.keys(filteredLoanCurrencies).forEach((key) => {
        filteredLoanCurrencies[key] = [
          ...new Map(
            filteredLoanCurrencies[key].map((item) => [item?.id || `${item?.name}-${item?.__component}`, item]),
          ).values(),
        ];
      });

      const news = await strapi.entityService.findMany("api::news-item.news-item", {
        filters: {
          locale: locale || "hy",
        },
        sort: { dateUpdated: "desc" },
        populate: {
          imageSrc: true,
        },
      });

      const exchangeCurrencies = await strapi.entityService.findMany(
        "api::exchange-rate.exchange-rate",
        {
          filters: {
            locale: "hy",
          },
          sort: { order: "asc" },
        },
      );

      const exchangeCurrenciesGold = await strapi.entityService.findMany(
        "api::gold-rate.gold-rate",
        {
          sort: { id: "asc" },
        }
      );
      
      const branches = await strapi.entityService.findMany(
        "api::branch.branch",
        {
          filters: {
            locale: locale || "hy",
            publishedAt: { $notNull: true },
          },
          populate: "*",
        },
      );
      return {
        globals,
        languages,
        loanGroups,
        loans,
        news,
        currencies: exchangeCurrencies,
        currenciesGold: exchangeCurrenciesGold,
        loanCurrencies: filteredLoanCurrencies,
        branches,
      };
    } catch (e) {
      console.log(e);
      return {
        languages: [],
        globals: [],
        loanGroups: [],
        loans: [],
        news: [],
        currencies: [],
        currenciesGold: [],
        loanCurrencies: [],
        branches: [],
      };
    }
  },
};
