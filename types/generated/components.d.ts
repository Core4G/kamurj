import type { Schema, Struct } from '@strapi/strapi';

export interface BranchListBranchList extends Struct.ComponentSchema {
  collectionName: 'components_branch_list_branch_lists';
  info: {
    displayName: 'branchList';
  };
  attributes: {
    branches: Schema.Attribute.Relation<'oneToMany', 'api::branch.branch'>;
  };
}

export interface BulletChainListBulletChainList extends Struct.ComponentSchema {
  collectionName: 'components_bullet_chain_list_bullet_chain_lists';
  info: {
    displayName: 'bulletChainList';
  };
  attributes: {
    plainText: Schema.Attribute.Component<'plain-text.plain-text', true>;
  };
}

export interface CombinedContentCombinedContent extends Struct.ComponentSchema {
  collectionName: 'components_combined_content_combined_contents';
  info: {
    displayName: 'combinedContent';
  };
  attributes: {
    branchList: Schema.Attribute.Component<'branch-list.branch-list', false>;
    bulletChain: Schema.Attribute.Component<
      'bullet-chain-list.bullet-chain-list',
      false
    >;
    detailsPanel: Schema.Attribute.Component<
      'details-panel.details-panel',
      false
    >;
    heading: Schema.Attribute.Component<'heading.heading', false>;
    map: Schema.Attribute.Component<'map.map', false>;
    newsList: Schema.Attribute.Component<'news-list.news-list', false>;
    personList: Schema.Attribute.Component<'person-list.person-list', false>;
    plainText: Schema.Attribute.Component<'plain-text.plain-text', false>;
    singleRow: Schema.Attribute.Component<'single-row.single-row', false>;
    singleRowList: Schema.Attribute.Component<
      'single-row-list.single-row-list',
      false
    >;
    vacancyList: Schema.Attribute.Component<'vacancy-list.vacancy-list', false>;
    widgetList: Schema.Attribute.Component<'widget-list.widget-list', false>;
  };
}

export interface DataTableRowCellDataTableRowCell
  extends Struct.ComponentSchema {
  collectionName: 'components_data_table_row_cell_data_table_row_cells';
  info: {
    displayName: 'dataTableRowCell';
  };
  attributes: {
    colSpan: Schema.Attribute.Integer & Schema.Attribute.Required;
    content: Schema.Attribute.Blocks;
  };
}

export interface DataTableRowDataTableRow extends Struct.ComponentSchema {
  collectionName: 'components_data_table_row_data_table_rows';
  info: {
    displayName: 'dataTableRow';
  };
  attributes: {
    cells: Schema.Attribute.Component<
      'data-table-row-cell.data-table-row-cell',
      true
    >;
    firstColContent: Schema.Attribute.Blocks;
  };
}

export interface DataTableDataTable extends Struct.ComponentSchema {
  collectionName: 'components_data_table_data_tables';
  info: {
    displayName: 'dataTable';
  };
  attributes: {
    rows: Schema.Attribute.Component<'data-table-row.data-table-row', true>;
  };
}

export interface DetailsPanelDetailsPanel extends Struct.ComponentSchema {
  collectionName: 'components_details_panel_details_panels';
  info: {
    displayName: 'detailsPanel';
  };
  attributes: {
    iconSrc: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    isUrl: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    rows: Schema.Attribute.Component<'single-row.single-row', true>;
    tables: Schema.Attribute.Component<'data-table.data-table', true>;
    title: Schema.Attribute.String;
    url: Schema.Attribute.Text;
  };
}

export interface HeadingHeading extends Struct.ComponentSchema {
  collectionName: 'components_heading_headings';
  info: {
    displayName: 'heading';
  };
  attributes: {
    description: Schema.Attribute.Text;
    imageSrc: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    title: Schema.Attribute.String;
  };
}

export interface LoanCurrencyLoanCurrency extends Struct.ComponentSchema {
  collectionName: 'components_loan_currency_loan_currencies';
  info: {
    displayName: 'loanCurrency';
  };
  attributes: {
    actualMaxRate: Schema.Attribute.Decimal;
    actualMinRate: Schema.Attribute.Decimal;
    icon: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    maxDuration: Schema.Attribute.BigInteger;
    maxInterestRate: Schema.Attribute.Decimal;
    maxValue: Schema.Attribute.BigInteger;
    minDuration: Schema.Attribute.BigInteger;
    minInterestRate: Schema.Attribute.Decimal;
    minValue: Schema.Attribute.BigInteger;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    strictInterestRate: Schema.Attribute.Decimal;
  };
}

export interface MapMap extends Struct.ComponentSchema {
  collectionName: 'components_map_maps';
  info: {
    displayName: 'map';
  };
  attributes: {
    branches: Schema.Attribute.Relation<'oneToMany', 'api::branch.branch'>;
  };
}

export interface NewsListNewsList extends Struct.ComponentSchema {
  collectionName: 'components_news_list_news_lists';
  info: {
    displayName: 'newsList';
  };
  attributes: {
    news_items: Schema.Attribute.Relation<
      'oneToMany',
      'api::news-item.news-item'
    >;
  };
}

export interface OptionItemOptionItem extends Struct.ComponentSchema {
  collectionName: 'components_option_item_option_items';
  info: {
    displayName: 'optionItem';
  };
  attributes: {
    combinedContent: Schema.Attribute.Component<
      'combined-content.combined-content',
      false
    >;
    title: Schema.Attribute.String;
  };
}

export interface OptionListOptionList extends Struct.ComponentSchema {
  collectionName: 'components_option_list_option_lists';
  info: {
    displayName: 'optionList';
  };
  attributes: {
    optionItems: Schema.Attribute.Component<'option-item.option-item', true>;
  };
}

export interface PersonItemPersonItem extends Struct.ComponentSchema {
  collectionName: 'components_person_item_person_items';
  info: {
    displayName: 'PersonItem';
  };
  attributes: {
    bio: Schema.Attribute.Blocks;
    imageSrc: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    name: Schema.Attribute.String;
    position: Schema.Attribute.String;
  };
}

export interface PersonListPersonList extends Struct.ComponentSchema {
  collectionName: 'components_person_list_person_lists';
  info: {
    displayName: 'personList';
  };
  attributes: {
    personItem: Schema.Attribute.Component<'person-item.person-item', true>;
    title: Schema.Attribute.String;
  };
}

export interface PlainTextPlainText extends Struct.ComponentSchema {
  collectionName: 'components_plain_text_plain_texts';
  info: {
    displayName: 'plainText';
  };
  attributes: {
    content: Schema.Attribute.Blocks;
  };
}

export interface SectionListItemBlockSectionListItemBlock
  extends Struct.ComponentSchema {
  collectionName: 'components_section_list_item_block_section_list_item_blocks';
  info: {
    displayName: 'sectionListItemBlock';
  };
  attributes: {
    combinedContent: Schema.Attribute.Component<
      'combined-content.combined-content',
      false
    >;
    optionList: Schema.Attribute.Component<'option-list.option-list', false>;
  };
}

export interface SectionListItemSectionListItem extends Struct.ComponentSchema {
  collectionName: 'components_section_list_item_section_list_items';
  info: {
    displayName: 'sectionListItem';
  };
  attributes: {
    sectionItemBlocks: Schema.Attribute.Component<
      'section-list-item-block.section-list-item-block',
      true
    >;
    title: Schema.Attribute.String;
  };
}

export interface SectionListSectionList extends Struct.ComponentSchema {
  collectionName: 'components_section_list_section_lists';
  info: {
    displayName: 'sectionList';
  };
  attributes: {
    sections: Schema.Attribute.Component<
      'section-list-item.section-list-item',
      true
    >;
  };
}

export interface SingleRowListSingleRowList extends Struct.ComponentSchema {
  collectionName: 'components_single_row_list_single_row_lists';
  info: {
    displayName: 'singleRowList';
  };
  attributes: {
    rows: Schema.Attribute.Component<'single-row.single-row', true>;
  };
}

export interface SingleRowSingleRow extends Struct.ComponentSchema {
  collectionName: 'components_single_row_single_rows';
  info: {
    displayName: 'singleRow';
  };
  attributes: {
    iconSrc: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    isUrl: Schema.Attribute.Boolean;
    title: Schema.Attribute.Blocks;
    url: Schema.Attribute.Text;
  };
}

export interface VacancyListVacancyList extends Struct.ComponentSchema {
  collectionName: 'components_vacancy_list_vacancy_lists';
  info: {
    displayName: 'vacancyList';
  };
  attributes: {
    vacancies: Schema.Attribute.Component<'vacancy.vacancy', true>;
  };
}

export interface VacancyVacancy extends Struct.ComponentSchema {
  collectionName: 'components_vacancy_vacancies';
  info: {
    displayName: 'vacancy';
  };
  attributes: {
    conent: Schema.Attribute.Component<'plain-text.plain-text', true>;
    title: Schema.Attribute.String;
  };
}

export interface WidgetListItemWidgetListItem extends Struct.ComponentSchema {
  collectionName: 'components_widget_list_item_widget_list_items';
  info: {
    displayName: 'widgetListItem';
  };
  attributes: {
    content: Schema.Attribute.Blocks;
    imageSrc: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    title: Schema.Attribute.String;
  };
}

export interface WidgetListWidgetList extends Struct.ComponentSchema {
  collectionName: 'components_widget_list_widget_lists';
  info: {
    displayName: 'widgetList';
  };
  attributes: {
    widgetListItem: Schema.Attribute.Component<
      'widget-list-item.widget-list-item',
      true
    >;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'branch-list.branch-list': BranchListBranchList;
      'bullet-chain-list.bullet-chain-list': BulletChainListBulletChainList;
      'combined-content.combined-content': CombinedContentCombinedContent;
      'data-table-row-cell.data-table-row-cell': DataTableRowCellDataTableRowCell;
      'data-table-row.data-table-row': DataTableRowDataTableRow;
      'data-table.data-table': DataTableDataTable;
      'details-panel.details-panel': DetailsPanelDetailsPanel;
      'heading.heading': HeadingHeading;
      'loan-currency.loan-currency': LoanCurrencyLoanCurrency;
      'map.map': MapMap;
      'news-list.news-list': NewsListNewsList;
      'option-item.option-item': OptionItemOptionItem;
      'option-list.option-list': OptionListOptionList;
      'person-item.person-item': PersonItemPersonItem;
      'person-list.person-list': PersonListPersonList;
      'plain-text.plain-text': PlainTextPlainText;
      'section-list-item-block.section-list-item-block': SectionListItemBlockSectionListItemBlock;
      'section-list-item.section-list-item': SectionListItemSectionListItem;
      'section-list.section-list': SectionListSectionList;
      'single-row-list.single-row-list': SingleRowListSingleRowList;
      'single-row.single-row': SingleRowSingleRow;
      'vacancy-list.vacancy-list': VacancyListVacancyList;
      'vacancy.vacancy': VacancyVacancy;
      'widget-list-item.widget-list-item': WidgetListItemWidgetListItem;
      'widget-list.widget-list': WidgetListWidgetList;
    }
  }
}
