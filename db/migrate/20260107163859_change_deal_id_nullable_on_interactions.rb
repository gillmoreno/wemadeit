class ChangeDealIdNullableOnInteractions < ActiveRecord::Migration[8.1]
  def change
    change_column_null :interactions, :deal_id, true
  end
end
