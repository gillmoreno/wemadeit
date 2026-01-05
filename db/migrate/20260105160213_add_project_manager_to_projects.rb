class AddProjectManagerToProjects < ActiveRecord::Migration[8.1]
  def change
    add_reference :projects, :project_manager, foreign_key: { to_table: :users }
  end
end
