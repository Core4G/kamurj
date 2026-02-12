import type { Schema, Struct } from '@strapi/strapi';

export interface DataTableRowCellDataTableRowCell
  extends Struct.ComponentSchema {
  collectionName: 'components_data_table_row_cell_data_table_row_cells';
  info: {
    displayName: 'dataTableRowCell';
  };
  attributes: {
    colSpan: Schema.Attribute.Integer;
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

export interface OptionItemWidgetOptionItemWidget
  extends Struct.ComponentSchema {
  collectionName: 'components_option_item_widget_option_item_widgets';
  info: {
    displayName: 'optionItemWidget';
  };
  attributes: {
    imageSrc: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
  };
}

export interface OptionItemOptionItem extends Struct.ComponentSchema {
  collectionName: 'components_option_item_option_items';
  info: {
    displayName: 'optionItem';
  };
  attributes: {
    OptionItemWidget: Schema.Attribute.Component<
      'option-item-widget.option-item-widget',
      true
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

export interface SingleRowSingleRow extends Struct.ComponentSchema {
  collectionName: 'components_single_row_single_rows';
  info: {
    displayName: 'singleRow';
  };
  attributes: {
    content: Schema.Attribute.Blocks;
    fileSrc: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
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
      'data-table-row-cell.data-table-row-cell': DataTableRowCellDataTableRowCell;
      'data-table-row.data-table-row': DataTableRowDataTableRow;
      'data-table.data-table': DataTableDataTable;
      'option-item-widget.option-item-widget': OptionItemWidgetOptionItemWidget;
      'option-item.option-item': OptionItemOptionItem;
      'option-list.option-list': OptionListOptionList;
      'person-item.person-item': PersonItemPersonItem;
      'person-list.person-list': PersonListPersonList;
      'plain-text.plain-text': PlainTextPlainText;
      'single-row.single-row': SingleRowSingleRow;
      'widget-list-item.widget-list-item': WidgetListItemWidgetListItem;
      'widget-list.widget-list': WidgetListWidgetList;
    }
  }
}
