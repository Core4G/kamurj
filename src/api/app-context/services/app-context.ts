 type NewsOptionItem = {
  showOnMainPage?: boolean;
  [key: string]: any;
};

type NewsOptionBlock = {
  newsOptionItems?: NewsOptionItem[];
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
          loan_group: true,
          mainImageSrc: true,
          widgetImageSrc: true,
          iconSrc: true,
          loan_currencies: { populate: { icon: true } },
          terms: {
            populate: {
              termData: {
                on: {
                  "plain-text.plain-text": {
                    populate: "*",
                  },
                  "data-table.data-table": {
                    populate: {
                      rows:{
                        populate: {
                          cells: {
                            populate: "*"
                          }
                        }
                      }
                    },
                  },
                  "single-row.single-row": {
                    populate: {
                      fileSrc: true
                    },
                  },
                },
              },
              fileSrc: true
      }
           },
        },
      });

      const filteredLoanCurrencies: Record<string, any[]> = {};

      loans.forEach((loan) => {
        if (!!filteredLoanCurrencies[loan["loan_group"].id]) {
          filteredLoanCurrencies[loan["loan_group"].id].push(
            ...loan["loan_currencies"],
          );
        } else {
          filteredLoanCurrencies[loan["loan_group"].id as string] = [
            ...loan["loan_currencies"],
          ] as any[];
        }
        if (!!filteredLoanCurrencies["all"]) {
          filteredLoanCurrencies["all"].push(...loan["loan_currencies"]);
        } else {
          filteredLoanCurrencies["all"] = [...loan["loan_currencies"]] as any[];
        }
      });

      filteredLoanCurrencies["all"] = [
        ...new Map(
          filteredLoanCurrencies["all"].map((item) => [item.id, item]),
        ).values(),
      ];

      const newsPage = (await strapi.entityService.findMany("api::news-page.news-page", {
        filters: { locale: locale || "hy" },
        populate: {
          newsOptions: {
            on: {
              "news-option.news-option": {
                populate: {
                  newsOptionItems: { populate: "*" },
                },
              },
            },
          },
        },
      })) as NewsPage;

      const news =
        (newsPage?.newsOptions ?? [])
          .flatMap((opt) => opt.newsOptionItems ?? [])
          .filter((item) => item.showOnMainPage === true);


      const exchangeCurrencies = await strapi.entityService.findMany(
        "api::exchange-rate.exchange-rate",
        {
          filters: {
            locale: "hy",
          },
        },
      );

      const exchangeCurrenciesGold = await strapi.entityService.findMany(
        "api::gold-rate.gold-rate",
        {
          sort: { id: "desc" },
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
