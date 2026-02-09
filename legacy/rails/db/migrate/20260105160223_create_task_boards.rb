class CreateTaskBoards < ActiveRecord::Migration[8.1]
  def change
    create_table :task_boards do |t|
      t.references :project, null: false, foreign_key: true
      t.string :name
      t.integer :position

      t.timestamps
    end
  end
end
