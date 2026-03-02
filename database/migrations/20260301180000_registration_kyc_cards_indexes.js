'use strict';

module.exports = {
  async up(knex) {
    const hasCustomerProfiles = await knex.schema.hasTable('customer_profiles');
    if (hasCustomerProfiles) {
      await knex.schema.alterTable('customer_profiles', (table) => {
        table.unique(['phone'], 'customer_profiles_phone_unique_idx');
      });
    }

    const hasOtpCodes = await knex.schema.hasTable('otp_codes');
    if (hasOtpCodes) {
      await knex.schema.alterTable('otp_codes', (table) => {
        table.index(['target'], 'otp_codes_target_idx');
        table.index(['session_id', 'purpose', 'channel'], 'otp_codes_lookup_idx');
      });
    }

    const hasPaymentCards = await knex.schema.hasTable('payment_cards');
    if (hasPaymentCards) {
      await knex.schema.alterTable('payment_cards', (table) => {
        table.unique(['user_id', 'fingerprint'], 'payment_cards_user_fingerprint_unique_idx');
        table.unique(['user_id', 'bank_card_id'], 'payment_cards_user_bankcard_unique_idx');
      });
    }
  },

  async down(knex) {
    const hasCustomerProfiles = await knex.schema.hasTable('customer_profiles');
    if (hasCustomerProfiles) {
      await knex.schema.alterTable('customer_profiles', (table) => {
        table.dropUnique(['phone'], 'customer_profiles_phone_unique_idx');
      });
    }

    const hasOtpCodes = await knex.schema.hasTable('otp_codes');
    if (hasOtpCodes) {
      await knex.schema.alterTable('otp_codes', (table) => {
        table.dropIndex(['target'], 'otp_codes_target_idx');
        table.dropIndex(['session_id', 'purpose', 'channel'], 'otp_codes_lookup_idx');
      });
    }

    const hasPaymentCards = await knex.schema.hasTable('payment_cards');
    if (hasPaymentCards) {
      await knex.schema.alterTable('payment_cards', (table) => {
        table.dropUnique(['user_id', 'fingerprint'], 'payment_cards_user_fingerprint_unique_idx');
        table.dropUnique(['user_id', 'bank_card_id'], 'payment_cards_user_bankcard_unique_idx');
      });
    }
  },
};
