class ChangeContactIdNullableOnInteractions < ActiveRecord::Migration[8.1]
  def change
    change_column_null :interactions, :contact_id, true
  end
end
