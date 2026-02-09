class CreateServices < ActiveRecord::Migration[8.1]
  def change
    create_table :services do |t|
      t.string :name
      t.string :code
      t.text :description
      t.integer :category
      t.decimal :unit_price
      t.string :unit_type
      t.boolean :active

      t.timestamps
    end
  end
end
