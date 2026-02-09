class RemoveOrganizationAndContactFromQuotations < ActiveRecord::Migration[8.1]
  def change
    # Remove foreign keys first
    remove_foreign_key :quotations, :organizations
    remove_foreign_key :quotations, :contacts

    # Remove columns
    remove_column :quotations, :organization_id, :bigint
    remove_column :quotations, :contact_id, :bigint

    # Make deal_id required
    change_column_null :quotations, :deal_id, false
  end
end
