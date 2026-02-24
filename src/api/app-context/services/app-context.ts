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

const PAGE_CONTENT_POPULATE = {
  pageContent: {
    on: {
      "section-list.section-list": {
        populate: {
          sections: {
            populate: {
              sectionItemBlocks: {
                populate: {
                  optionList: {
                    populate: {
                      optionItems: {
                        populate: {
                          combinedContent: {
                            populate: {
                              branchList: {
                                populate: {
                                  branches: {
                                    populate: {
                                      iconSrc: true,
                                    },
                                  },
                                },
                              },
                              detailsPanel: {
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
                              heading: {
                                populate: {
                                  imageSrc: true,
                                },
                              },
                              map: {
                                populate: {
                                  branches: {
                                    populate: {
                                      iconSrc: true,
                                    },
                                  },
                                },
                              },
                              newsList: {
                                populate: {
                                  news_items: {
                                    populate: {
                                      imageSrc: true,
                                    },
                                  },
                                },
                              },
                              widgetList: {
                                populate: {
                                  widgetListItem: {
                                    populate: {
                                      imageSrc: true,
                                    },
                                  },
                                },
                              },
                              vacancyList: {
                                populate: {
                                  vacancies: {
                                    populate: {
                                      conent: true,
                                    },
                                  },
                                },
                              },
                              personList: {
                                populate: {
                                  personItem: {
                                    populate: {
                                      imageSrc: true,
                                    },
                                  },
                                },
                              },
                              plainText: true,
                              singleRowList: {
                                populate: {
                                  rows: {
                                    populate: {
                                      iconSrc: true,
                                    },
                                  },
                                },
                              },
                              singleRow: {
                                populate: {
                                  iconSrc: true,
                                },
                              },
                              bulletChain: {
                                populate: {
                                  plainText: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  combinedContent: {
                    populate: {
                      branchList: {
                        populate: {
                          branches: {
                            populate: {
                              iconSrc: true,
                            },
                          },
                        },
                      },
                      detailsPanel: {
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
                      heading: {
                        populate: {
                          imageSrc: true,
                        },
                      },
                      map: {
                        populate: {
                          branches: {
                            populate: {
                              iconSrc: true,
                            },
                          },
                        },
                      },
                      newsList: {
                        populate: {
                          news_items: {
                            populate: {
                              imageSrc: true,
                            },
                          },
                        },
                      },
                      widgetList: {
                        populate: {
                          widgetListItem: {
                            populate: {
                              imageSrc: true,
                            },
                          },
                        },
                      },
                      vacancyList: {
                        populate: {
                          vacancies: {
                            populate: {
                              conent: true,
                            },
                          },
                        },
                      },
                      personList: {
                        populate: {
                          personItem: {
                            populate: {
                              imageSrc: true,
                            },
                          },
                        },
                      },
                      plainText: true,
                      singleRowList: {
                        populate: {
                          rows: {
                            populate: {
                              iconSrc: true,
                            },
                          },
                        },
                      },
                      singleRow: {
                        populate: {
                          iconSrc: true,
                        },
                      },
                      bulletChain: {
                        populate: {
                          plainText: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "option-list.option-list": {
        populate: {
          optionItems: {
            populate: {
              combinedContent: {
                populate: {
                  branchList: {
                    populate: {
                      branches: {
                        populate: {
                          iconSrc: true,
                        },
                      },
                    },
                  },
                  detailsPanel: {
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
                  heading: {
                    populate: {
                      imageSrc: true,
                    },
                  },
                  map: {
                    populate: {
                      branches: {
                        populate: {
                          iconSrc: true,
                        },
                      },
                    },
                  },
                  newsList: {
                    populate: {
                      news_items: {
                        populate: {
                          imageSrc: true,
                        },
                      },
                    },
                  },
                  widgetList: {
                    populate: {
                      widgetListItem: {
                        populate: {
                          imageSrc: true,
                        },
                      },
                    },
                  },
                  vacancyList: {
                    populate: {
                      vacancies: {
                        populate: {
                          conent: true,
                        },
                      },
                    },
                  },
                  personList: {
                    populate: {
                      personItem: {
                        populate: {
                          imageSrc: true,
                        },
                      },
                    },
                  },
                  plainText: true,
                  singleRowList: {
                    populate: {
                      rows: {
                        populate: {
                          iconSrc: true,
                        },
                      },
                    },
                  },
                  singleRow: {
                    populate: {
                      iconSrc: true,
                    },
                  },
                  bulletChain: {
                    populate: {
                      plainText: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      "combined-content.combined-content": {
        populate: {
          branchList: {
            populate: {
              branches: {
                populate: {
                  iconSrc: true,
                },
              },
            },
          },
          detailsPanel: {
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
          heading: {
            populate: {
              imageSrc: true,
            },
          },
          map: {
            populate: {
              branches: {
                populate: {
                  iconSrc: true,
                },
              },
            },
          },
          newsList: {
            populate: {
              news_items: {
                populate: {
                  imageSrc: true,
                },
              },
            },
          },
          widgetList: {
            populate: {
              widgetListItem: {
                populate: {
                  imageSrc: true,
                },
              },
            },
          },
          vacancyList: {
            populate: {
              vacancies: {
                populate: {
                  conent: true,
                },
              },
            },
          },
          personList: {
            populate: {
              personItem: {
                populate: {
                  imageSrc: true,
                },
              },
            },
          },
          plainText: true,
          singleRowList: {
            populate: {
              rows: {
                populate: {
                  iconSrc: true,
                },
              },
            },
          },
          singleRow: {
            populate: {
              iconSrc: true,
            },
          },
          bulletChain: {
            populate: {
              plainText: true,
            },
          },
        },
      },
    },
  },
};

const HOME_PAGE_POPULATE = {
  calculatorSectionImage: true,
  mainLoans: {
    populate: {
      purpose: true,
      loan_group: {
        populate: {
          iconSrc: true,
          activeIconSrc: true,
          purposes: true,
        },
      },
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
  },
  topLoans: {
    populate: {
      purpose: true,
      loan_group: {
        populate: {
          iconSrc: true,
          activeIconSrc: true,
          purposes: true,
        },
      },
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
  },
  top_news: {
    populate: {
      imageSrc: true,
      localizations: true,
    },
  },
  exchange_rates: true,
  gold_rates: true,
};

const isValidPageName = (pageName: string) => /^[a-z0-9-]+$/.test(pageName);

module.exports = {
  async getPageData(locale, pageName) {
    if (!pageName || !isValidPageName(pageName)) {
      throw new Error("Invalid page name");
    }

    const uid = `api::${pageName}.${pageName}`;
    const contentType = strapi.contentTypes[uid as keyof typeof strapi.contentTypes] as any;

    if (!contentType) {
      throw new Error(`Unknown page content type: ${pageName}`);
    }

    const isLocalized = !!contentType?.pluginOptions?.i18n?.localized;
    const hasPageContent = !!contentType?.attributes?.pageContent;

    const localeValue = locale || "hy";

    const populate = {
      ...(isLocalized ? { localizations: true } : {}),
      ...(hasPageContent ? PAGE_CONTENT_POPULATE : {}),
      ...(uid === "api::home-page.home-page" ? HOME_PAGE_POPULATE : {}),
    };

    if (!hasPageContent && uid !== "api::home-page.home-page") {
      throw new Error(`Unsupported page structure for: ${pageName}`);
    }

    const baseQuery: any = {
      publicationState: "live",
      populate: populate as any,
    };

    if (isLocalized) {
      baseQuery.locale = localeValue;
    }

    let data = await strapi.entityService.findMany(uid as any, baseQuery);

    if (!data && isLocalized) {
      data = await strapi.entityService.findMany(uid as any, {
        publicationState: "live",
        populate: populate as any,
      });
    }

    return data ?? null;
  },

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
