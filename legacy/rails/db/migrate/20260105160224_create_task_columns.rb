class CreateTaskColumns < ActiveRecord::Migration[8.1]
  def change
    create_table :task_columns do |t|
      t.references :task_board, null: false, foreign_key: true
      t.string :name
      t.integer :position
      t.string :color
      t.integer :wip_limit

      t.timestamps
    end
  end
end
