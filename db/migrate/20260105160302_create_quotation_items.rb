class CreateQuotationItems < ActiveRecord::Migration[8.1]
  def change
    create_table :quotation_items do |t|
      t.references :quotation, null: false, foreign_key: true
      t.references :service, null: false, foreign_key: true
      t.string :name
      t.text :description
      t.decimal :quantity
      t.string :unit_type
      t.decimal :unit_price
      t.decimal :line_total
      t.integer :position

      t.timestamps
    end
  end
end
