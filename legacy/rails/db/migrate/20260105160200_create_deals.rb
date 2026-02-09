class CreateDeals < ActiveRecord::Migration[8.1]
  def change
    create_table :deals do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.references :pipeline_stage, null: false, foreign_key: true
      t.string :title
      t.decimal :value
      t.string :currency
      t.date :expected_close_date
      t.string :source
      t.integer :status
      t.text :lost_reason
      t.text :notes

      t.timestamps
    end
  end
end
