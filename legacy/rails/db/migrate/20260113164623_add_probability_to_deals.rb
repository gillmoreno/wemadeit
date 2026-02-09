class AddProbabilityToDeals < ActiveRecord::Migration[8.1]
  def change
    add_column :deals, :probability, :integer
  end
end
