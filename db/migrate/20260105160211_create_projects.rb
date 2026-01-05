class CreateProjects < ActiveRecord::Migration[8.1]
  def change
    create_table :projects do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :deal, null: false, foreign_key: true
      t.string :name
      t.string :code
      t.text :description
      t.integer :project_type
      t.integer :status
      t.date :start_date
      t.date :target_end_date
      t.date :actual_end_date
      t.decimal :budget
      t.string :currency

      t.timestamps
    end
  end
end
