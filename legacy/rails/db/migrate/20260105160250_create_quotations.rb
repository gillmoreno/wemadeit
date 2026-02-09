class CreateQuotations < ActiveRecord::Migration[8.1]
  def change
    create_table :quotations do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :contact, foreign_key: true
      t.references :deal, foreign_key: true
      t.string :number, null: false
      t.string :title, null: false
      t.text :introduction
      t.text :terms_and_conditions
      t.decimal :subtotal, precision: 12, scale: 2
      t.decimal :tax_rate, precision: 5, scale: 2, default: 22.0
      t.decimal :tax_amount, precision: 12, scale: 2
      t.decimal :discount_amount, precision: 12, scale: 2, default: 0
      t.decimal :total, precision: 12, scale: 2
      t.string :currency, default: "EUR"
      t.date :valid_until
      t.integer :status, default: 0
      t.integer :version, default: 1
      t.string :public_token

      t.timestamps
    end

    add_index :quotations, :number, unique: true
    add_index :quotations, :public_token, unique: true
  end
end
