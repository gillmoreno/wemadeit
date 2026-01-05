class AddUserRefsToTasks < ActiveRecord::Migration[8.1]
  def change
    add_reference :tasks, :assigned_to, foreign_key: { to_table: :users }
    add_reference :tasks, :created_by, null: false, foreign_key: { to_table: :users }
  end
end
