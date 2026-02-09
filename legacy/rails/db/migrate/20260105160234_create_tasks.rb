class CreateTasks < ActiveRecord::Migration[8.1]
  def change
    create_table :tasks do |t|
      t.references :task_column, null: false, foreign_key: true
      t.string :title
      t.text :description
      t.integer :position
      t.integer :priority
      t.date :due_date
      t.integer :estimated_hours
      t.integer :actual_hours

      t.timestamps
    end
  end
end
