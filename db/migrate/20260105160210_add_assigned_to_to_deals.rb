class AddAssignedToToDeals < ActiveRecord::Migration[8.1]
  def change
    add_reference :deals, :assigned_to, null: false, foreign_key: { to_table: :users }
  end
end
