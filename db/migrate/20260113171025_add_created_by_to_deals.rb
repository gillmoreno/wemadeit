class AddCreatedByToDeals < ActiveRecord::Migration[8.1]
  def change
    add_reference :deals, :created_by, null: true, foreign_key: { to_table: :users }
  end
end
