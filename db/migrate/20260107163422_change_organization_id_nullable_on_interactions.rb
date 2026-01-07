class ChangeOrganizationIdNullableOnInteractions < ActiveRecord::Migration[8.1]
  def change
    change_column_null :interactions, :organization_id, true
  end
end
