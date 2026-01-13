class AddDescriptionToDeals < ActiveRecord::Migration[8.1]
  def change
    add_column :deals, :description, :text
  end
end
